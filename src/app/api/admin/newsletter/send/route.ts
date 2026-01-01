import { createClient } from '@/lib/supabase/server';
import sgMail from '@sendgrid/mail';

const sendgridApiKey = process.env.SENDGRID_API_KEY!;

if (!sendgridApiKey) {
  throw new Error('SENDGRID_API_KEY is not configured');
}

sgMail.setApiKey(sendgridApiKey);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { campaignId, testEmail } = await request.json();

    if (!campaignId) {
      return Response.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // If testEmail is provided, send test email only
    if (testEmail) {
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/newsletter/unsubscribe?token=test-token`;
      
      const msg = {
        to: testEmail,
        from: {
          email: campaign.from_email,
          name: campaign.from_name,
        },
        subject: `[TEST] ${campaign.subject}`,
        html: campaign.html_content.replace('{{unsubscribe_url}}', unsubscribeUrl),
      };

      await sgMail.send(msg);

      return Response.json({ 
        success: true, 
        message: `Test email sent to ${testEmail}` 
      });
    }

    // Get all subscribed users
    const { data: subscribers, error: subscribersError } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, unsubscribe_token')
      .eq('status', 'subscribed');

    if (subscribersError || !subscribers || subscribers.length === 0) {
      return Response.json({ error: 'No active subscribers found' }, { status: 400 });
    }

    // Update campaign status
    await supabase
      .from('newsletter_campaigns')
      .update({ 
        status: 'sending', 
        total_recipients: subscribers.length 
      })
      .eq('id', campaignId);

    // Send emails in batches
    const batchSize = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const sendPromises = batch.map(async (subscriber) => {
        const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
        
        try {
          const msg = {
            to: subscriber.email,
            from: {
              email: campaign.from_email,
              name: campaign.from_name,
            },
            subject: campaign.subject,
            html: campaign.html_content.replace('{{unsubscribe_url}}', unsubscribeUrl),
            customArgs: {
              campaign_id: campaignId,
              subscriber_id: subscriber.id,
            },
          };

          const [response] = await sgMail.send(msg);
          
          // Record successful send
          await supabase.from('newsletter_campaign_sends').insert({
            campaign_id: campaignId,
            subscriber_id: subscriber.id,
            email: subscriber.email,
            status: 'sent',
            sendgrid_message_id: response.headers['x-message-id'],
            sent_at: new Date().toISOString(),
          });

          successCount++;
        } catch (error: any) {
          console.error(`Failed to send to ${subscriber.email}:`, error);
          
          // Record failed send
          await supabase.from('newsletter_campaign_sends').insert({
            campaign_id: campaignId,
            subscriber_id: subscriber.id,
            email: subscriber.email,
            status: 'failed',
            error_message: error.message,
          });

          failCount++;
        }
      });

      await Promise.allSettled(sendPromises);
    }

    // Update campaign with final stats
    await supabase
      .from('newsletter_campaigns')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        successful_sends: successCount,
        failed_sends: failCount,
      })
      .eq('id', campaignId);

    return Response.json({ 
      success: true,
      message: `Campaign sent to ${successCount} subscribers`,
      stats: {
        total: subscribers.length,
        successful: successCount,
        failed: failCount,
      }
    });

  } catch (error: any) {
    console.error('Error sending campaign:', error);
    return Response.json(
      { error: error.message || 'Failed to send campaign' },
      { status: 500 }
    );
  }
}
