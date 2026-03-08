import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Logger } from 'pino';

const sesClient = new SESClient({});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@mcpsearch.com';

interface EmailNotificationPayload {
  templateId: string;
  recipient: string;
  data: Record<string, unknown>;
}

// Email templates
const templates: Record<string, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to MCPSearch!',
    htmlBody: (data: Record<string, unknown>) => `
      <h1>Welcome to MCPSearch, ${data.username}!</h1>
      <p>Thank you for joining MCPSearch. You can now:</p>
      <ul>
        <li>Search and discover MCP servers</li>
        <li>Install MCPs with our CLI tool</li>
        <li>Publish your own MCP servers</li>
      </ul>
      <p>Get started by installing our CLI:</p>
      <pre>npm install -g @mcpsearch/cli</pre>
      <p>Happy coding!</p>
      <p>The MCPSearch Team</p>
    `,
    textBody: (data: Record<string, unknown>) => `
Welcome to MCPSearch, ${data.username}!

Thank you for joining MCPSearch. You can now:
- Search and discover MCP servers
- Install MCPs with our CLI tool
- Publish your own MCP servers

Get started by installing our CLI:
npm install -g @mcpsearch/cli

Happy coding!
The MCPSearch Team
    `,
  },
  packagePublished: {
    subject: (data: Record<string, unknown>) =>
      `Your package ${data.packageName} has been published!`,
    htmlBody: (data: Record<string, unknown>) => `
      <h1>Package Published Successfully</h1>
      <p>Great news! Your package <strong>${data.packageName}</strong> version ${data.version} has been published to MCPSearch.</p>
      <p>View your package: <a href="${data.packageUrl}">${data.packageUrl}</a></p>
      <p>Users can now install it using:</p>
      <pre>mcp install ${data.packageId}</pre>
      <p>Thank you for contributing to the MCP ecosystem!</p>
      <p>The MCPSearch Team</p>
    `,
    textBody: (data: Record<string, unknown>) => `
Package Published Successfully

Great news! Your package ${data.packageName} version ${data.version} has been published to MCPSearch.

View your package: ${data.packageUrl}

Users can now install it using:
mcp install ${data.packageId}

Thank you for contributing to the MCP ecosystem!
The MCPSearch Team
    `,
  },
  scanFailed: {
    subject: (data: Record<string, unknown>) =>
      `Security scan failed for ${data.packageName}`,
    htmlBody: (data: Record<string, unknown>) => `
      <h1>Security Scan Results</h1>
      <p>We found some issues while scanning your package <strong>${data.packageName}</strong> version ${data.version}.</p>
      <h2>Issues Found:</h2>
      <ul>
        ${(data.issues as Array<{ message: string }>)?.map((i) => `<li>${i.message}</li>`).join('')}
      </ul>
      <p>Please address these issues and republish your package.</p>
      <p>If you believe this is an error, please contact support.</p>
      <p>The MCPSearch Team</p>
    `,
    textBody: (data: Record<string, unknown>) => `
Security Scan Results

We found some issues while scanning your package ${data.packageName} version ${data.version}.

Issues Found:
${(data.issues as Array<{ message: string }>)?.map((i) => `- ${i.message}`).join('\n')}

Please address these issues and republish your package.

If you believe this is an error, please contact support.

The MCPSearch Team
    `,
  },
  passwordReset: {
    subject: 'Reset your MCPSearch password',
    htmlBody: (data: Record<string, unknown>) => `
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your MCPSearch password.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>The MCPSearch Team</p>
    `,
    textBody: (data: Record<string, unknown>) => `
Password Reset Request

We received a request to reset your MCPSearch password.

Click the link below to reset your password:
${data.resetUrl}

This link will expire in 24 hours.

If you didn't request this, you can safely ignore this email.

The MCPSearch Team
    `,
  },
};

interface EmailTemplate {
  subject: string | ((data: Record<string, unknown>) => string);
  htmlBody: (data: Record<string, unknown>) => string;
  textBody: (data: Record<string, unknown>) => string;
}

export async function handleEmailNotification(
  payload: EmailNotificationPayload,
  logger: Logger
): Promise<void> {
  const { templateId, recipient, data } = payload;

  logger.info({ templateId, recipient }, 'Sending email notification');

  const template = templates[templateId];
  if (!template) {
    logger.error({ templateId }, 'Unknown email template');
    throw new Error(`Unknown email template: ${templateId}`);
  }

  const subject =
    typeof template.subject === 'function' ? template.subject(data) : template.subject;

  await sesClient.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [recipient],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: template.htmlBody(data),
            Charset: 'UTF-8',
          },
          Text: {
            Data: template.textBody(data),
            Charset: 'UTF-8',
          },
        },
      },
    })
  );

  logger.info({ templateId, recipient }, 'Email sent successfully');
}
