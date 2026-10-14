---
title: 从 Cookie 到 CORS：一条主线理解浏览器跨域
author: Vic Agent
date: 2026-10-14
category: 技术
excerpt: Cookie 为什么会自动携带，SameSite、同源策略与 CORS 又分别保护什么？沿着一次浏览器请求，把跨域问题完整串起来。
published: true
---
***从我开始做第一个Web项目以来，我就知道了浏览器跨域问题，但是从来就没明白过这个问题的原因是什么，每次就在Server端配点东西就也能Work，何况现在这么多Coding Agent，很多操作都不求甚解了。但是还是想彻底弄明白这个问题，感觉只有这样，才能解我的心结。***

浏览器跨域之所以容易讲乱，是因为几个机制经常同时出现：Cookie、SameSite、同源策略、CORS、预检请求、CSRF。它们都和“从一个网站访问另一个网站”有关，却分别解决不同的问题。

理解它们最顺畅的方式，不是逐条背响应头，而是沿着一条因果链往下走：

```text
Cookie 的诞生
    ↓
浏览器自动携带凭证
    ↓
跨站请求带来安全风险
    ↓
SameSite 限制跨站 Cookie
    ↓
同源策略限制跨源数据读取
    ↓
CORS 允许服务器有条件地开放读取
    ↓
后端配置 CORS，或通过反向代理变成同源
```

这条链的最后还要补上一句：**CORS 不是身份认证，也不能单独防止 CSRF。**

## 1. Cookie：浏览器为什么能记住登录状态？

HTTP 本身是无状态的。服务器收到两个请求时，默认不知道它们是否来自同一个用户。

用户登录 `bank.com` 后，服务器可以在响应里设置 Cookie：

```http
HTTP/1.1 200 OK
Set-Cookie: session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax
```

浏览器保存 Cookie。之后再次请求符合条件的地址时，会自动带上它：

```http
GET /account HTTP/1.1
Host: bank.com
Cookie: session=abc123
```

服务器根据 `session=abc123` 找到对应会话，于是知道这是谁。

这里最重要的一点是：**Cookie 是否匹配，主要看请求要发往哪里，而不是看当前页面从哪里打开。**

浏览器会综合检查：

- `Domain`：目标主机是否匹配；
- `Path`：目标路径是否匹配；
- `Secure`：是否通过 HTTPS；
- `SameSite`：当前上下文是否允许跨站携带；
- 有效期：Cookie 是否已经过期；
- 浏览器策略：第三方 Cookie 是否被限制；
- Fetch 凭证模式：脚本是否允许这次请求使用凭证。

`fetch()` 默认使用 `credentials: "same-origin"`，只在同源请求中使用凭证。跨源请求若需要 Cookie，前端通常要显式设置：

```js
fetch("https://api.example.com/profile", {
  credentials: "include",
});
```

但 `include` 不是“强制带上所有 Cookie”。它只是让浏览器考虑使用凭证，最终仍然要服从 Cookie 自身的 Domain、Secure、SameSite 以及浏览器隐私策略。

## 2. 风险：恶意网站不需要读取 Cookie

假设你已经登录 `bank.com`，随后又打开了 `evil.com`。恶意页面尝试发起请求：

```js
fetch("https://bank.com/transfer", {
  method: "POST",
  credentials: "include",
});
```

如果银行 Cookie 的策略允许跨站携带，浏览器可能把登录凭证一起发往 `bank.com`。银行看到的是一个带有效会话的请求。

`evil.com` 不需要知道 Cookie 的值。`HttpOnly` 可以阻止 JavaScript 读取 Cookie，但不能阻止浏览器在满足条件时自动发送 Cookie。

这会引出两个不同的问题：

| 风险 | 攻击者想要什么 | 主要防线 |
| --- | --- | --- |
| CSRF（跨站请求伪造） | 借助用户登录状态执行操作 | SameSite、CSRF Token、Origin 校验 |
| 跨源数据窃取 | 读取另一个来源返回的敏感数据 | 同源策略、正确的 CORS 配置 |

一个关注“请求能不能借身份发出去”，另一个关注“响应能不能被攻击者的 JavaScript 读到”。不要把它们混成同一件事。

## 3. SameSite：限制跨站请求携带 Cookie

浏览器需要一种方法，限制 Cookie 在跨站上下文中自动发送。这就是 `SameSite`。

| SameSite 值 | 典型跨站 `fetch` | 跨站顶层导航 | 适用场景 |
| --- | --- | --- | --- |
| `Strict` | 不携带 | 通常不携带 | 高敏感后台、管理系统 |
| `Lax` | 通常不携带 | 部分安全方法导航可携带 | 常规登录会话的常用默认值 |
| `None` | 可以携带 | 可以携带 | 确实需要第三方上下文的场景 |

`SameSite=None` 必须与 `Secure` 一起使用：

```http
Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=None
```

即便如此，现代浏览器的第三方 Cookie 限制仍可能阻止它。

### “同站”和“同源”不是一回事

这是理解后续机制的关键。

- **同源（same-origin）**看协议、主机、端口；
- **同站（same-site）**按 schemeful site 判断，核心是协议和可注册域名，端口不参与。

因此，`https://app.example.com` 与 `https://api.example.com` 通常是同站的，但它们仍然是跨源的。SameSite 可能允许 Cookie，而同源策略依然会限制 JavaScript 读取响应。

SameSite 解决的是“Cookie 是否允许在这个跨站上下文中发送”，它不是跨域读取授权。

## 4. 同源策略：默认隔离跨源数据

同源由三个部分组成：

```text
协议 + 主机 + 端口
```

| 当前页面 | 目标地址 | 是否同源 | 原因 |
| --- | --- | --- | --- |
| `https://a.com` | `https://a.com/api` | 是 | 三项相同 |
| `https://a.com` | `https://b.com/api` | 否 | 主机不同 |
| `https://a.com` | `http://a.com/api` | 否 | 协议不同 |
| `https://a.com` | `https://a.com:8080/api` | 否 | 端口不同 |
| `https://app.example.com` | `https://api.example.com` | 否 | 子域不同 |

浏览器的同源策略（Same-Origin Policy，SOP）默认限制一个来源的脚本访问另一个来源的数据。

假设 `evil.com` 执行：

```js
const response = await fetch("https://bank.com/account");
const data = await response.json();
```

即使服务器实际返回了 `200 OK`，只要 `bank.com` 没有通过 CORS 授权，浏览器也不会把响应内容交给 `evil.com` 的 JavaScript。

注意措辞：**同源策略不是禁止所有跨源请求，而是重点限制跨源响应的读取和跨源对象的访问。**

图片、样式、表单提交、顶层导航等跨源行为长期存在。某些请求完全可能到达服务器并产生副作用，只是发起页面无法读取响应。这也是“有 SOP 为什么还需要防 CSRF”的答案。

## 5. CORS：由服务器授予跨源读取权限

现实项目常把前端和 API 部署在不同来源：

```text
前端：https://app.example.com
后端：https://api.example.com
```

如果浏览器一律不允许读取跨源响应，前后端分离就无法工作。CORS（Cross-Origin Resource Sharing）提供了一套授权协议：目标服务器通过响应头告诉浏览器，哪些来源可以读取响应。

例如 API 返回：

```http
Access-Control-Allow-Origin: https://app.example.com
Vary: Origin
```

浏览器看到明确授权后，才把响应暴露给前端 JavaScript。若响应没有正确的 CORS 头，网络面板里可能仍能看到 HTTP `200`，但脚本得到的仍然是 CORS 错误。

### 携带 Cookie 时，两端都要同意

前端需要声明：

```js
fetch("https://api.example.com/profile", {
  credentials: "include",
});
```

后端响应也必须包含：

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

带凭证的请求不能使用：

```http
Access-Control-Allow-Origin: *
```

因为通配符没有表达“我明确相信这个携带用户身份的来源”。

即使 CORS 允许凭证，Cookie 的 SameSite、Secure 和第三方 Cookie 策略仍然独立生效。CORS 不会替你放宽 Cookie。

## 6. OPTIONS：浏览器为什么要先“问一下”？

有些跨源请求会直接发送，有些则先发送预检请求。

满足特定方法、请求头和 Content-Type 约束的请求称为“简单请求”。浏览器通常直接发送它，再根据响应中的 CORS 头决定脚本能否读取。

对于 `PUT`、`DELETE`、自定义请求头、`application/json` 等非简单场景，浏览器通常先发出 `OPTIONS`：

```http
OPTIONS /profile HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, x-request-id
```

服务器可以这样回答：

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, PUT
Access-Control-Allow-Headers: content-type, x-request-id
Access-Control-Max-Age: 600
```

预检通过后，浏览器才发送真正的 `PUT` 请求。

预检不是登录认证。它只在浏览器的 CORS 协议中确认“这个来源能否使用这些方法和请求头”。真正的请求仍然必须经过服务端的身份认证、权限检查和参数校验。

非浏览器客户端也不会因为服务器配置了 CORS 就失去调用能力。`curl`、服务端程序和攻击脚本并不受浏览器同源策略约束。

## 7. 工程中解决跨域的两条主路

### 方案 A：后端显式配置 CORS

适合前端和 API 必须使用不同来源的系统。

以 FastAPI 为例：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Request-Id"],
)
```

生产环境应列出可信来源，而不是把收到的任意 `Origin` 原样反射回去。允许的方法和请求头也应尽量收窄。

### 方案 B：反向代理，把浏览器入口变成同源

```text
浏览器
  │
  ├── https://app.example.com/       → 前端
  │
  └── https://app.example.com/api/   → Nginx
                                         │
                                         ▼
                                   内部后端服务
```

前端始终请求当前来源：

```js
fetch("/api/profile");
```

Nginx 在服务器侧把 `/api/` 转发给内部后端。浏览器看到的协议、主机和端口都没有变化，因此不需要进行跨源 CORS 授权。

这通常能简化 Cookie、环境配置和本地联调，但它不会自动提供接口权限控制。后端依然必须验证用户身份。

### `mode: "no-cors"` 不是解决方案

把请求写成：

```js
fetch("https://api.example.com/data", { mode: "no-cors" });
```

不会让跨域响应变得可读。浏览器通常只会给脚本一个不可读取正文和多数响应头的 opaque response，同时方法和请求头也受到限制。它适合少数“不关心响应内容”的资源发送场景，不是绕过 CORS 的办法。

## 8. 为什么有 SameSite 和 CORS，仍然需要 CSRF 防护？

因为这些机制的职责并不相同：

- SameSite 能显著减少跨站 Cookie 自动携带，但并不覆盖所有导航、旧环境和特殊业务场景；
- 同源策略与 CORS 主要控制响应能否被浏览器脚本读取，不保证请求没有到达服务器；
- CORS 配置错误、允许了不可信来源，或者系统使用非 Cookie 凭证时，风险模型还会变化；
- 认证只说明“你是谁”，授权仍要判断“你能不能执行这个操作”。

对转账、修改密码、绑定账号等敏感写操作，应组合使用：

1. 会话 Cookie 设置 `Secure`、`HttpOnly` 和合适的 `SameSite`；
2. 使用不可预测并与会话绑定的 CSRF Token；
3. 服务端校验 `Origin`，必要时结合 `Referer`；
4. 不把 GET 设计成有副作用的操作；
5. 对每个接口执行身份认证和资源级权限检查；
6. 高风险操作增加二次确认、幂等控制和审计记录。

## 9. 用四个问题快速定位跨域故障

遇到“跨域报错”时，不要先复制一组 CORS 响应头。依次问：

### 1. 这是跨站，还是跨源？

跨站影响 SameSite；跨源触发同源策略和 CORS。两个子域可能同站但跨源。

### 2. 请求有没有真正发出去？

查看 Network：是预检失败、真实请求失败，还是请求成功但响应被浏览器拦截？

### 3. Cookie 为什么没有发送？

检查 Domain、Path、Secure、SameSite、有效期、第三方 Cookie 策略，以及 `credentials` 配置。

### 4. 就算浏览器允许读取，服务端是否允许这个用户操作？

CORS 通过不代表认证或授权通过。服务端权限模型始终是最后一道边界。

## 10. 把整条逻辑串起来

| 层次 | 解决的问题 | 不负责什么 |
| --- | --- | --- |
| Cookie | 让浏览器保存并自动发送会话凭证 | 不决定脚本能否读取跨源响应 |
| SameSite | 限制 Cookie 在跨站上下文中的携带 | 不等于同源策略，不完整替代 CSRF 防护 |
| 同源策略 | 默认隔离不同来源的脚本与数据 | 不保证跨源请求永远不会发送 |
| CORS | 让服务器有条件地允许跨源读取 | 不是认证、授权或防火墙 |
| 反向代理 | 为浏览器提供统一来源 | 不替代后端权限校验 |
| CSRF 防护 | 阻止攻击者借用户会话执行敏感操作 | 不能只依赖单一响应头 |

最终可以用一句话建立完整认知：

> Cookie 让浏览器能够保持登录状态，但自动携带凭证也带来了安全风险；SameSite 限制跨站凭证发送，同源策略默认隔离跨源数据，CORS 允许服务器有条件地开放跨源读取，而敏感操作仍必须由服务端通过 CSRF 防护、认证和授权守住最后边界。
