function formatAmount(value) {
  var num = Number(value);
  if (!isFinite(num)) return '';
  return String(Math.round(num * 100) / 100)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function inferBillingFromPreview(item) {
  if (!item) return 'monthly';
  var monthly = Number(item.monthlyPayAmount);
  var total = Number(item.payAmount);
  if (isFinite(monthly) && monthly > 0 && isFinite(total) && total > 0) {
    var ratio = total / monthly;
    if (ratio > 6) return 'yearly';
    if (ratio > 1.5) return 'quarterly';
    return 'monthly';
  }
  var discounts = item.campaignDiscountDetails || [];
  for (var i = 0; i < discounts.length; i++) {
    var campaignName = discounts[i] && (discounts[i].campaignName || discounts[i].rewardDetail) || '';
    if (campaignName.indexOf('年') !== -1) return 'yearly';
    if (campaignName.indexOf('季') !== -1) return 'quarterly';
  }
  return 'monthly';
}

function getPromoTag(item) {
  var discounts = item && item.campaignDiscountDetails;
  if (!discounts || !discounts.length) return '';
  return discounts[0].rewardDetail || discounts[0].campaignName || '';
}

function getRenewLabel(billing) {
  if (billing === 'yearly') return '下个年度续费金额';
  if (billing === 'quarterly') return '下个季度续费金额';
  return '下个月续费金额';
}

function getLocalAuthHeaders() {
  try {
    var jwt = '';
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var part = cookies[i].trim();
      if (part.indexOf('bigmodel_token_production=') === 0) {
        jwt = part.substring('bigmodel_token_production='.length);
        break;
      }
    }
    var org = localStorage.getItem('Bigmodel-Organization');
    var proj = localStorage.getItem('Bigmodel-Project');
    if (!jwt || !org || !proj) return null;
    return {
      authorization: jwt.indexOf('Bearer ') === 0 ? jwt : 'Bearer ' + jwt,
      bigmodelOrganization: org,
      bigmodelProject: proj
    };
  } catch(e) {
    return null;
  }
}
