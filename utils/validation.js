const isStrongPassword = (password) => {
  return /^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

module.exports = { isStrongPassword, isValidEmail };
