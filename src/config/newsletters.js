// src/config/newsletters.js
/**
 * Configuration for newsletter sources
 * This file contains a list of email addresses from newsletter providers
 * that should be included in the daily summary.
 */

const newsletterSources = [
    // Technology newsletters
    'news@daily.therundown.ai',
    // 'morning.brew@morningbrew.com',
    // 'newsletters@theverge.com',
    // 'today@techmeme.com',
    // 'briefing@theinformation.com',
    // 'techmeme-daily@techmeme.com',
    
    // // Business newsletters
    // 'newsletters@economist.com',
    // 'newsletter@stratechery.com',
    // 'digest@hbr.org',
    // 'editorial@morningbrew.com',
    
    // // News newsletters
    // 'dailybrief@foreignpolicy.com',
    // 'morning_briefing@nytimes.com',
    // 'newsletters@axios.com',
    
    // // AI newsletters
    // 'newsletter@deeplearning.ai',
    // 'team@huggingface.substack.com',
    // 'news@openai.com',
    // 'digest@ai.stanford.edu',
    
    // Add your own newsletter sources here
  ];
  
  // Helper function to create Gmail query for newsletters
  const createNewsletterQuery = () => {
    if (newsletterSources.length === 0) {
      return '';
    }
    
    // Create OR conditions for each email address
    const fromConditions = newsletterSources.map(email => `from:${email}`);
    return `(${fromConditions.join(' OR ')})`;
  };
  
  module.exports = {
    newsletterSources,
    createNewsletterQuery
  };


