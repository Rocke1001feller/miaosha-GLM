<script lang="ts">
  let { title, description }: { title: string; description: string } = $props();
</script>

<div class="placeholder">
  <div class="card">
    <div class="badge">敬请期待</div>
    <div class="title">{title}</div>
    <div class="desc">{description}</div>
    <div class="qr-frame">
      <img src="/group-buy-qr.png" alt="拼团转让交流群二维码" width="180" height="180" />
    </div>
    <div class="qr-caption">飞书扫码加群 · 长期有效</div>
  </div>
</div>

<style>
  .placeholder {
    flex: 1;
    display: grid;
    place-items: center;
    background: #f5f3ee;
    padding: 20px;
  }

  .card {
    width: 100%;
    border: 1.5px dashed #0c1224;
    border-radius: 12px;
    background: #ffffff;
    padding: 28px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #f5f3ee;
    background: #0c1224;
    border-radius: 4px;
    padding: 3px 10px;
  }

  .title {
    font-size: 16px;
    font-weight: 800;
    color: #0c1224;
    margin-top: 4px;
  }

  .desc {
    font-size: 11px;
    line-height: 1.6;
    color: #6a7496;
  }

  .qr-frame {
    margin-top: 8px;
    padding: 10px;
    background: #ffffff;
    border: 1.5px solid #0c1224;
    border-radius: 10px;
    box-shadow: 4px 4px 0 rgba(12, 18, 36, 0.14);
    line-height: 0;
  }

  .qr-frame img {
    width: 180px;
    height: 180px;
    display: block;
  }

  .qr-caption {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.05em;
    color: #6a7496;
  }
</style>
