const nodemailer = require("nodemailer");

jest.mock("nodemailer");
const mockSendMail = jest.fn();

describe("Utility Functions", () => {

    describe("Sending Email", () => {
    beforeEach(() => {
      nodemailer.createTransport.mockReturnValue({
        sendMail: mockSendMail,
      });
      mockSendMail.mockReset();
    });

    test("Basic test for sending an email with mock transporter", async () => {
      const transporter = nodemailer.createTransport(); // this uses the mock

      const mailOptions = {
        from: "test@example.com",
        to: "user@example.com",
        subject: "Test Subject",
        text: "Test body",
      };

      await transporter.sendMail(mailOptions);

      expect(mockSendMail).toHaveBeenCalledWith(mailOptions);
    });
  });
});