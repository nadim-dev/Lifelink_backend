export const generateResetPasswordTemplate = (resetLink) => {
  return `
    <div>
      <h2>Reset Your Password</h2>

      <p>
        We received a request to reset your password.
      </p>

      <a href="${resetLink}">
        Reset Password
      </a>

      <p>
        This link will expire in 15 minutes.
      </p>

      <p>
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
};