import "server-only";
import sgMail from "@sendgrid/mail";

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!sendgridApiKey) {
  console.warn("SENDGRID_API_KEY is not configured");
} else {
  sgMail.setApiKey(sendgridApiKey);
}

export async function sendTicketCreatedEmail(
  email: string,
  ticketId: string,
  subject: string
) {
  if (!sendgridApiKey) {
    console.warn("Skipping email - SENDGRID_API_KEY not configured");
    return;
  }

  try {
    const ticketUrl = `${siteUrl}/support/tickets/${ticketId}`;

    await sgMail.send({
      to: email,
      from: {
        email: "support@help.optrader.cards",
        name: "OP Trader Support",
      },
      replyTo: "support@help.optrader.cards",
      subject: `[Ticket #${ticketId}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Support Ticket Created</h2>
          <p>Hi,</p>
          <p>Thank you for creating a support ticket. We've received your request and will get back to you as soon as possible.</p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <p>You can view and track your ticket here:</p>
          <a href="${ticketUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Your Ticket
          </a>
          
          <p style="margin-top: 30px; color: #666;">
            Best regards,<br>
            OP Trader Support Team
          </p>
        </div>
      `,
    });

    console.log(`Ticket created email sent to ${email}`);
  } catch (error) {
    console.error("Error sending ticket created email:", error);
  }
}

export async function sendTicketResponseEmail(
  email: string,
  ticketId: string,
  subject: string,
  message: string
) {
  if (!sendgridApiKey) {
    console.warn("Skipping email - SENDGRID_API_KEY not configured");
    return;
  }

  try {
    const ticketUrl = `${siteUrl}/support/tickets/${ticketId}`;

    await sgMail.send({
      to: email,
      from: {
        email: "support@help.optrader.cards",
        name: "OP Trader Support",
      },
      replyTo: "support@help.optrader.cards",
      subject: `[Ticket #${ticketId}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">New Response to Your Support Ticket</h2>
          <p>Hi,</p>
          <p>We've added a response to your support ticket. Here's what we said:</p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; white-space: pre-wrap; color: #333;">${message}</p>
          </div>
          
          <p>You can view the full conversation here:</p>
          <a href="${ticketUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Ticket
          </a>
          
          <p style="margin-top: 30px; color: #666;">
            Best regards,<br>
            OP Trader Support Team
          </p>
        </div>
      `,
    });

    console.log(`Ticket response email sent to ${email}`);
  } catch (error) {
    console.error("Error sending ticket response email:", error);
  }
}

export async function sendTicketResolvedEmail(
  email: string,
  ticketId: string,
  subject: string
) {
  if (!sendgridApiKey) {
    console.warn("Skipping email - SENDGRID_API_KEY not configured");
    return;
  }

  try {
    const ticketUrl = `${siteUrl}/support/tickets/${ticketId}`;

    await sgMail.send({
      to: email,
      from: {
        email: "support@help.optrader.cards",
        name: "OP Trader Support",
      },
      replyTo: "support@help.optrader.cards",
      subject: `[Ticket #${ticketId}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Support Ticket Resolved</h2>
          <p>Hi,</p>
          <p>Great news! Your support ticket has been marked as resolved. We hope we were able to help.</p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <p>If you have any further questions or need additional assistance, you can reply to this ticket:</p>
          <a href="${ticketUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Ticket
          </a>
          
          <p style="margin-top: 30px; color: #666;">
            Thank you for choosing OP Trader!<br>
            Support Team
          </p>
        </div>
      `,
    });

    console.log(`Ticket resolved email sent to ${email}`);
  } catch (error) {
    console.error("Error sending ticket resolved email:", error);
  }
}
