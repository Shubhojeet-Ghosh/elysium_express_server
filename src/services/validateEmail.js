const validateEmail = (email) => {
  // Basic RFC 5322 official standard email regex (safe for most real-world use)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

module.exports = { validateEmail };
