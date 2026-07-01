// Tiny auth helpers used by UI code that only needs to know whether a stored
// session exists. Full login/logout behavior lives in the page/layout modules.
export function getToken() {
  return localStorage.getItem('vizzio_token');
}

export function isAuthenticated() {
  return Boolean(getToken());
}
