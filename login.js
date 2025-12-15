(async () => {
  try {
    const res = await fetch('http://localhost:4010/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' })
    });
    const text = await res.text();
    console.log(text);
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();

