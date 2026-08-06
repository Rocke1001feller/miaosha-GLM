// Dynamic pricing via Volcengine calculatePriceV5.

const PRICE_RETRY_MAX = 3;
const PRICE_RETRY_BASE_MS = 300;

function isRetryableNetworkError(err) {
  // AbortError is intentional — don't retry.
  if (err && err.name === 'AbortError') return false;
  // fetch() throws TypeError for transient network failures such as
  // ERR_CONNECTION_CLOSED, ERR_NETWORK_CHANGED, ERR_CERT_AUTHORITY_INVALID,
  // DNS failures, and CORS preflight failures.
  return err instanceof TypeError || (err && err.name === 'TypeError');
}

async function fetchPrice(configBody) {
  const cookies = getCookies();
  const csrf = cookies['csrfToken'];
  const webId = cookies['monitor_huoshan_web_id'];
  if (!csrf || !webId) return null;

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'x-csrf-token': csrf,
    'monitor-huoshan-web-id': webId,
    'x-language': 'zh',
    'x-use-bff-version': '1',
  };
  if (cookies['monitor_utm']) {
    headers['monitor-utm'] = cookies['monitor_utm'];
  }

  const chargeItems = (configBody.ChargeItemList || []).map(function (item) {
    return {
      ChargeItemCode: item.ChargeItemCode,
      AttrValue: String(item.Count || '1'),
    };
  });

  const body = JSON.stringify({
    ConfigItems: [{
      Product: configBody.Product,
      ConfigurationCode: configBody.ConfigurationCode,
      ChargeItems: chargeItems,
      Quantity: configBody.Quantity || 1,
      Period: configBody.DurationUnit || 'monthly',
      Times: configBody.Duration || 1,
      OrderType: 1,
      SerialNo: '0',
    }],
  });

  let lastError = null;
  for (let attempt = 1; attempt <= PRICE_RETRY_MAX; attempt++) {
    try {
      const res = await fetch('https://www.volcengine.com/api/sales/calculatePriceV5', {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: body,
      });
      const data = await res.json();
      const error = data.ResponseMetadata?.Error;
      if (error) {
        console.warn('[volc-main] calculatePriceV5 error', error);
        return null;
      }
      const result = data.Result || {};
      return {
        original: parseFloat(result.TotalOriginalAmount) || 0,
        current: parseFloat(result.TotalDiscountAmount) || 0,
      };
    } catch (e) {
      lastError = e;
      if (!isRetryableNetworkError(e) || attempt >= PRICE_RETRY_MAX) {
        break;
      }
      const delay = PRICE_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.debug('[volc-main] calculatePriceV5 transient failure (attempt ' + attempt + '/' + PRICE_RETRY_MAX + '), retry in ' + delay + 'ms', e?.message || e);
      await new Promise(function (resolve) { setTimeout(resolve, delay); });
    }
  }

  console.warn('[volc-main] calculatePriceV5 failed after ' + PRICE_RETRY_MAX + ' attempts: ' + (lastError?.message || lastError));
  return null;
}

async function fetchAllPrices(items) {
  const prices = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.configBody.ConfigurationCode + '|' + (item.configBody.Duration || 1);
    const price = await fetchPrice(item.configBody);
    prices[key] = price || { original: 0, current: 0 };
  }
  return prices;
}
