// Production: nginx trong container client proxy /api → service api.
export const environment = {
  production: true,
  apiUrl: '/api',
  // Tạo OAuth 2.0 Client ID (Web application) trên Google Cloud Console rồi điền vào đây.
  // Xem hướng dẫn trong README.md mục "Google Login".
  googleClientId: ''
};
