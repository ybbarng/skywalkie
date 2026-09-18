/**
 * 비상용 웹 채팅 화면.
 *
 * **아이폰 앱이 만료돼도 대화할 수 있다.** 설치 없이 사파리로 들어온다.
 * 유료 개발자 계정이 없어 7일마다 앱이 죽는데, 여행이 그보다 길면
 * 이게 유일한 길이다.
 *
 * ## 한 장에 다 담는다
 *
 * HTML, CSS, JavaScript 를 한 파일에 담고 **바깥에서 아무것도 불러오지
 * 않는다.** 비행기에 인터넷이 없어서, 밖에서 가져오게 해두면 전부
 * 빈칸이 된다. 글꼴도 기기에 있는 것만 쓴다.
 *
 * 글자로 들고 있는 이유는 빌드 과정을 하나 더 두지 않기 위해서다.
 * 파일을 읽어 오게 하면 번들에 넣는 설정이 따로 필요하다.
 *
 * (docs/04-transport-spec.md 5장 · T21)
 */

export function chatPage(peerName: string): string {
  return `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(peerName)} 와의 대화</title>
<style>
:root{
  color-scheme:light dark;
  --bg:#FFFFFF;--surface:#F4F4F5;--text:#18181B;--muted:#71717A;
  --me:#C2410C;--peer:#0369A1;--line:#E4E4E7;--on:#FFFFFF;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#09090B;--surface:#18181B;--text:#FAFAFA;--muted:#A1A1AA;
  --me:#FF9D5C;--peer:#5CC8FF;--line:#27272A;--on:#0B1020;
}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;margin:0}
body{
  background:var(--bg);color:var(--text);
  font:16px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;
  display:flex;flex-direction:column;
  padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
header{
  padding:12px 16px;border-bottom:1px solid var(--line);
  display:flex;align-items:center;gap:8px;
}
header b{font-size:15px}
#dot{width:8px;height:8px;border-radius:4px;background:var(--muted)}
#dot.on{background:#16A34A}
#log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.row{display:flex}
.row.me{justify-content:flex-end}
.b{
  max-width:78%;padding:8px 14px;border-radius:16px;
  background:var(--surface);white-space:pre-wrap;word-break:break-word;
}
.row.me .b{background:var(--me);color:var(--on);border-bottom-right-radius:4px}
.row:not(.me) .b{border-bottom-left-radius:4px}
.t{font-size:11px;color:var(--muted);align-self:flex-end;margin:0 6px}
.sys{text-align:center;color:var(--muted);font-size:13px;margin:8px 0}
form{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line)}
input{
  flex:1;font:inherit;padding:10px 14px;border-radius:20px;
  border:1px solid var(--line);background:var(--bg);color:var(--text);
}
button{
  font:inherit;font-weight:600;padding:10px 18px;border:0;border-radius:20px;
  background:var(--me);color:var(--on);
}
button:disabled{opacity:.5}
</style>

<header>
  <span id="dot"></span>
  <b>${escapeHtml(peerName)}</b>
  <span id="state" style="color:var(--muted);font-size:13px">잇는 중</span>
</header>

<div id="log"></div>

<form id="f">
  <input id="i" placeholder="말을 적어보세요" autocomplete="off" enterkeyhint="send">
  <button id="s" type="submit">보내기</button>
</form>

<script>
var log = document.getElementById('log')
var dot = document.getElementById('dot')
var state = document.getElementById('state')
var seen = {}
var since = 0

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function time(ms){
  var d = new Date(ms)
  return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2)
}

function draw(m){
  // **같은 메시지를 두 번 그리지 않는다.** 다시 이을 때 겹쳐 온다.
  if (seen[m.id]) return
  seen[m.id] = 1

  if (m.kind === 'system') {
    var s = document.createElement('div')
    s.className = 'sys'
    s.textContent = m.text
    log.appendChild(s)
  } else {
    var row = document.createElement('div')
    row.className = 'row' + (m.mine ? ' me' : '')
    row.innerHTML = '<div class="b">' + esc(m.text) + '</div>' +
                    '<span class="t">' + time(m.at) + '</span>'
    log.appendChild(row)
  }

  log.scrollTop = log.scrollHeight
  if (m.at > since) since = m.at
}

function online(on){
  dot.className = on ? 'on' : ''
  state.textContent = on ? '이어짐' : '다시 잇는 중'
}

/**
 * 새 말을 받아온다.
 *
 * SSE 대신 오래 기다리는 요청을 쓴다. 사파리가 뒤로 갔다 오면 SSE 가
 * 조용히 끊기는데, 그걸 알아채기가 어렵다. 이 방식은 끊기면 바로
 * 다시 건다.
 */
function poll(){
  var x = new XMLHttpRequest()
  x.open('GET', '/messages?since=' + since, true)
  x.timeout = 35000

  x.onload = function(){
    online(true)
    try {
      var data = JSON.parse(x.responseText)
      for (var i = 0; i < data.messages.length; i++) draw(data.messages[i])
    } catch (e) {}
    setTimeout(poll, 100)
  }

  x.onerror = x.ontimeout = function(){
    online(false)
    // 곧바로 다시 걸면 폰이 뜨거워진다. 조금 쉰다.
    setTimeout(poll, 1500)
  }

  x.send()
}

document.getElementById('f').onsubmit = function(e){
  e.preventDefault()
  var input = document.getElementById('i')
  var text = input.value.trim()
  if (!text) return

  input.value = ''

  var x = new XMLHttpRequest()
  x.open('POST', '/send', true)
  x.setRequestHeader('Content-Type', 'application/json')
  x.onerror = function(){
    // 못 보냈다. 적은 글을 돌려준다. 사라지면 다시 쓰기 싫어진다.
    input.value = text
    online(false)
  }
  x.send(JSON.stringify({ text: text }))
}

poll()
</script>
`
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
