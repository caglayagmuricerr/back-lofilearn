const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const generateOTP = () => {
  let OTP = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    OTP += numbers[randomIndex];
  }
  return OTP;
};

module.exports = generateOTP;
