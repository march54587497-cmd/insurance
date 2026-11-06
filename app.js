// Preview only: no uploads, OCR, persistence, lead delivery or outbound messaging.
const $ = id => document.getElementById(id);
const photos = new Map();
const choices = { drivers: '', coverage: '', claims: '', overseas: '' };
let basic = null, summaryText = '', expiryUnknown = false, purpose = '车险咨询';

function error(id, message) {
  const output = $(`${id}-error`);
  output.textContent = message; output.hidden = !message;
  const input = $(id === 'consent' ? 'consent-required' : id);
  if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
}
function phoneIsValid(value) {
  const digits = value.replace(/[\s()+-]/g, '');
  return /^(?:0(?:10|11|16|17|18|19)\d{7,8}|02\d{7,8}|0[3-6][1-5]\d{7,8}|82(?:10|11|16|17|18|19)\d{7,8}|822\d{7,8}|82[3-6][1-5]\d{7,8})$/.test(digits);
}
function show(stage) {
  $('lead-form').hidden = stage !== 'basic'; $('optional-stage').hidden = stage !== 'optional'; $('summary').hidden = stage !== 'summary';
  const titles = { basic: '免费车险咨询', optional: '再补充一点，就更清楚', summary: '需求已在本页整理' };
  $('form-title').textContent = titles[stage];
  $('step-label').textContent = stage === 'basic' ? '1 / 2 · 必填' : stage === 'optional' ? '2 / 2 · 选填' : '预览完成';
  $('progress').style.width = stage === 'basic' ? '50%' : '100%';
  document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', stage === 'basic' ? '1' : '2');
  const target = stage === 'basic' ? $('name') : stage === 'optional' ? $('optional-title') : $('summary-title');
  target.focus({ preventScroll: true }); $('application-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('form-status').textContent = stage === 'optional' ? '基础资料已在本页准备好，未发送。第 2 步全部选填，可跳过。' : titles[stage];
}
function photoWidget(key) { return document.querySelector(`[data-photo="${key}"]`); }
function removePhoto(key) {
  const old = photos.get(key); if (old) URL.revokeObjectURL(old.url); photos.delete(key);
  const widget = photoWidget(key);
  widget.querySelector('.photo-preview').hidden = true; widget.querySelector('.photo-drop').hidden = false;
  widget.querySelector('img').removeAttribute('src'); widget.querySelector('.photo-name').textContent = '';
  widget.querySelectorAll('input[type="file"]').forEach(input => { input.value = ''; }); error(key, '');
}
async function selectPhoto(key, input) {
  const file = input.files && input.files[0]; if (!file) return;
  const previous = photos.get(key), widget = photoWidget(key);
  const serial = (Number(widget.dataset.serial) || 0) + 1; widget.dataset.serial = String(serial);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    input.value = ''; error(key, '请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。' + (previous ? '原照片仍保留。' : '')); return;
  }
  const url = URL.createObjectURL(file), image = new Image(); image.src = url;
  try { await image.decode(); }
  catch { URL.revokeObjectURL(url); input.value = ''; if (widget.dataset.serial === String(serial)) error(key, '图片无法读取，请重新选择清晰完整的照片。'); return; }
  if (widget.dataset.serial !== String(serial)) { URL.revokeObjectURL(url); return; }
  if (previous) URL.revokeObjectURL(previous.url);
  photos.set(key, { file, url }); widget.querySelector('img').src = url;
  widget.querySelector('.photo-name').textContent = file.name; widget.querySelector('.photo-preview').hidden = false;
  widget.querySelector('.photo-drop').hidden = true; error(key, ''); $('form-status').textContent = '照片已在本页预览，未上传。';
}
document.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => $(button.dataset.pick).click()));
document.querySelectorAll('[data-photo]').forEach(widget => {
  const key = widget.dataset.photo;
  widget.querySelectorAll('input[type="file"]').forEach(input => input.addEventListener('change', () => selectPhoto(key, input)));
  widget.querySelector('.photo-remove').addEventListener('click', () => {
    widget.dataset.serial = String((Number(widget.dataset.serial) || 0) + 1); removePhoto(key); widget.querySelector('[data-pick]').focus();
  });
});
function syncAllConsent() {
  const required = $('consent-required').checked, optional = $('consent-optional').checked;
  $('consent-all').checked = required && optional; $('consent-all').indeterminate = required !== optional;
  if (required) error('consent', '');
}
$('consent-all').addEventListener('change', () => {
  $('consent-required').checked = $('consent-all').checked; $('consent-optional').checked = $('consent-all').checked; syncAllConsent();
});
['consent-required', 'consent-optional'].forEach(id => $(id).addEventListener('change', syncAllConsent));
['name', 'phone', 'plate'].forEach(id => $(id).addEventListener('input', () => error(id, '')));
$('lead-form').addEventListener('submit', event => {
  event.preventDefault(); const name = $('name').value.trim(), phone = $('phone').value.trim(), plate = $('plate').value.trim(), errors = [];
  if (!name) errors.push(['name', '请输入称呼或姓名。']);
  if (!phoneIsValid(phone)) errors.push(['phone', '请输入韩国联系电话，例如 010-1234-5678。']);
  if (plate.replace(/\s/g, '').length < 4 || !/\d/.test(plate)) errors.push(['plate', '请输入车辆号码，例如 123가 4567。']);
  if (!photos.has('registration')) errors.push(['registration', '请选择一张车辆登记证示例照片。']);
  if (!$('consent-required').checked) errors.push(['consent', '请阅读并勾选必填同意；选填提醒不影响继续。']);
  ['name', 'phone', 'plate', 'registration', 'consent'].forEach(id => error(id, '')); errors.forEach(([id, message]) => error(id, message));
  if (errors.length) {
    const first = errors[0][0]; if (first === 'consent') $('consent-details').open = true;
    const target = first === 'registration' ? photoWidget(first).querySelector('[data-pick]') : $(first === 'consent' ? 'consent-required' : first);
    target.focus(); $('form-status').textContent = '请补充标记的基础资料。'; return;
  }
  basic = { name, phone, plate, reminders: $('consent-optional').checked }; show('optional');
});
document.querySelectorAll('[data-choice]').forEach(group => group.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
  const key = group.dataset.choice, value = button.dataset.value || button.textContent.trim(); choices[key] = choices[key] === value ? '' : value;
  group.querySelectorAll('button').forEach(item => { const active = (item.dataset.value || item.textContent.trim()) === choices[key]; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active)); });
  if (key === 'overseas') {
    $('overseas-photo-block').hidden = choices.overseas !== '有';
    if (choices.overseas !== '有') { const widget = photoWidget('overseas'); widget.dataset.serial = String((Number(widget.dataset.serial) || 0) + 1); removePhoto('overseas'); }
  }
})));
$('expiry-unknown').addEventListener('click', () => {
  expiryUnknown = !expiryUnknown; $('expiry-unknown').setAttribute('aria-pressed', String(expiryUnknown)); $('expiry-unknown').classList.toggle('selected', expiryUnknown); if (expiryUnknown) $('expiry').value = '';
});
$('expiry').addEventListener('input', () => { expiryUnknown = false; $('expiry-unknown').setAttribute('aria-pressed', 'false'); $('expiry-unknown').classList.remove('selected'); });
function finish(skipped) {
  if (!basic) return;
  const photoLabel = key => photos.has(key) ? '已选择照片（仅本页，未上传）' : '未提供';
  const rows = [['咨询类型', purpose], ['姓名', basic.name], ['联系电话', basic.phone], ['车牌号码', basic.plate], ['车辆登记证', photoLabel('registration')], ['必填同意', '已勾选（服务预览）'], ['补充提醒意愿', basic.reminders ? '愿意（未发送提醒）' : '不接收'], ['补充资料', skipped ? '已跳过，本次摘要只含基础资料' : '已整理，待顾问确认']];
  if (!skipped) rows.push(['驾驶人范围', choices.drivers || '待确认'], ['到期 / 投保日', $('expiry').value || (expiryUnknown ? '不清楚' : '待确认')], ['保障偏好', choices.coverage || '待顾问建议'], ['驾驶证', photoLabel('license')], ['事故经历', choices.claims || '不清楚'], ['折扣 / 加费等级', $('discount').value || '不清楚'], ['海外投保经历', choices.overseas || '不清楚'], ['海外保险证明', photoLabel('overseas')]);
  $('summary-list').replaceChildren();
  for (const [key, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; $('summary-list').append(dt, dd); }
  $('summary-description').textContent = skipped ? '已跳过选填。若想补充，随时点下方按钮；已填写的选填草稿仍在当前页面。' : '已整理你的选择。不确定的项目，之后可交由顾问确认。';
  summaryText = 'Ansim Car 安心车险 · 本地预览需求摘要\r\n\r\n' + rows.map(([k, v]) => `${k}：${v}`).join('\r\n') + '\r\n\r\n尚未提交申请、发送照片或提醒。本文件不含照片，非正式报价或投保凭证。请妥善保管含联系方式的摘要。'; show('summary');
}
$('optional-form').addEventListener('submit', event => { event.preventDefault(); finish(false); });
['skip-top', 'skip-bottom'].forEach(id => $(id).addEventListener('click', () => finish(true)));
$('edit-basic').addEventListener('click', () => show('basic')); $('resume').addEventListener('click', () => show('optional'));
$('download').addEventListener('click', () => {
  if (!summaryText) return; const url = URL.createObjectURL(new Blob(['\ufeff' + summaryText], { type: 'text/plain;charset=utf-8' })), link = document.createElement('a');
  link.href = url; link.download = 'Ansim-Car-咨询需求.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function clearData() {
  document.querySelectorAll('[data-photo]').forEach(widget => { widget.dataset.serial = String((Number(widget.dataset.serial) || 0) + 1); removePhoto(widget.dataset.photo); });
  $('lead-form').reset(); $('optional-form').reset(); basic = null; summaryText = ''; expiryUnknown = false; purpose = '车险咨询';
  Object.keys(choices).forEach(key => { choices[key] = ''; });
  document.querySelectorAll('[data-choice] button, #expiry-unknown').forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
  $('overseas-photo-block').hidden = true; $('summary-list').replaceChildren(); $('summary-description').textContent = '';
  ['name', 'phone', 'plate', 'consent'].forEach(id => error(id, '')); $('consent-details').open = false;
  document.querySelectorAll('.more-details').forEach(details => { details.open = false; }); syncAllConsent();
}
$('reset').addEventListener('click', () => { clearData(); show('basic'); $('form-status').textContent = '已清除本页资料和照片。'; });
$('lead-form').reset(); $('optional-form').reset(); syncAllConsent();
window.addEventListener('pagehide', () => clearData()); window.addEventListener('pageshow', event => { if (event.persisted) show('basic'); });
document.querySelectorAll('[data-purpose]').forEach(link => link.addEventListener('click', () => { purpose = link.dataset.purpose; }));
$('privacy-link').addEventListener('click', event => { event.preventDefault(); $('privacy').showModal(); }); $('close-privacy').addEventListener('click', () => $('privacy').close());
$('privacy').addEventListener('click', event => { if (event.target !== $('privacy')) return; const rect = $('privacy').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('privacy').close(); });

const wechatDialog = $('wechat-dialog');
document.querySelectorAll('[data-wechat]').forEach(button => button.addEventListener('click', () => wechatDialog.showModal()));
$('close-wechat').addEventListener('click', () => wechatDialog.close());
$('wechat-to-form').addEventListener('click', () => { wechatDialog.close(); document.getElementById('quote').scrollIntoView({behavior:'smooth',block:'start'}); });
wechatDialog.addEventListener('click', event => { if(event.target !== wechatDialog) return; const r = wechatDialog.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) wechatDialog.close(); });

$('copy-wechat').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('minseo627');
    $('copy-status').textContent = '已复制 minseo627，请打开微信搜索添加。';
    $('copy-wechat').textContent = '已复制微信号 ✓';
  } catch {
    $('copy-status').textContent = '无法自动复制，请长按上方微信号，选择复制。';
  }
});
wechatDialog.addEventListener('close', () => { $('copy-status').textContent = ''; $('copy-wechat').textContent = '复制微信号 ＋'; });
