import axios from 'axios';
export async function logout(): Promise<void> {
  const token = localStorage.getItem('accessToken');
  try {
    if (token) await axios.post('/api/v1/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
  } finally {
    for (const key of ['accessToken', 'userRole', 'userEmail', 'userId', 'adminAccessLevel']) localStorage.removeItem(key);
  }
}
