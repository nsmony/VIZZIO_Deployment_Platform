export function getToken() {
  return localStorage.getItem('vizzio_token');
}

export function isAuthenticated() {
  return Boolean(getToken());
}
