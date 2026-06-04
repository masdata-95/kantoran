export const SKILLS_PRESET: Record<string, string[]> = {
  'Data & Analytics': [
    'Microsoft Excel', 'Google Sheets', 'SQL', 'Python', 'R',
    'Power BI', 'Tableau', 'Looker Studio', 'SPSS', 'SAS',
    'Data Cleaning', 'Data Visualization', 'Statistical Analysis',
    'ETL', 'BigQuery', 'Pandas', 'NumPy', 'Matplotlib',
  ],
  'Marketing & Creative': [
    'Canva', 'Adobe Photoshop', 'Adobe Illustrator', 'Figma',
    'Meta Ads', 'Google Ads', 'TikTok Ads', 'SEO', 'SEM',
    'Copywriting', 'Content Writing', 'Social Media Management',
    'Email Marketing', 'Google Analytics', 'Mailchimp',
  ],
  'Finance & Accounting': [
    'Financial Modeling', 'Financial Analysis', 'Budgeting',
    'SAP', 'Accurate', 'MYOB', 'Oracle', 'QuickBooks',
    'Akuntansi', 'Audit', 'Pajak', 'Laporan Keuangan',
    'Variance Analysis', 'Cash Flow Management',
  ],
  'HR & People': [
    'Rekrutmen', 'Talent Acquisition', 'HRIS', 'Payroll',
    'Performance Management', 'Training & Development',
    'Employee Relations', 'Kompensasi & Benefit',
    'Organizational Development', 'Labor Law',
  ],
  'Business & Strategy': [
    'Business Development', 'Market Research', 'Business Analysis',
    'Project Management', 'Presentasi', 'Negosiasi',
    'CRM', 'Salesforce', 'Partnership Management',
    'Business Intelligence', 'KPI Tracking',
  ],
  'Tech & Development': [
    'Microsoft Office', 'Google Workspace', 'Notion', 'Slack',
    'Trello', 'Jira', 'Asana', 'Microsoft Teams',
    'HTML/CSS', 'JavaScript', 'No-code Tools',
  ],
  'Soft Skills': [
    'Komunikasi', 'Teamwork', 'Problem Solving', 'Critical Thinking',
    'Adaptasi', 'Time Management', 'Leadership', 'Public Speaking',
    'Multitasking', 'Detail-oriented', 'Fast Learner',
  ],
}

export const ALL_SKILLS = Object.values(SKILLS_PRESET).flat()
