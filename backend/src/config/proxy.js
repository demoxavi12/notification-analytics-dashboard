// Number of trusted reverse-proxy hops in front of the API (TRUST_PROXY).
//
// Unset/0 (default): trust none, so req.ip is the socket address and a client cannot
// spoof X-Forwarded-For to dodge per-IP rate limits. Behind a proxy/load balancer set
// it to the number of proxies (usually 1); never `true`, which trusts any header value.
const resolveTrustProxy = (value = process.env.TRUST_PROXY) => {
  const hops = Number.parseInt(value, 10);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
};

module.exports = { resolveTrustProxy };
