// mailService.js

const nodemailer = require('nodemailer');
// 【关键改动】引入 dotenv 来读取 .env 文件中的配置
require('dotenv').config();

// 我们将使用一个异步函数来创建 transporter
let transporter;

async function getTransporter() {
  // 如果 transporter 已创建，直接返回
  if (transporter) {
    return transporter;
  }

  // 【关键改动】不再创建 Ethereal 账户，而是直接使用 QQ 邮箱的配置
  transporter = nodemailer.createTransport({
    host: 'smtp.qq.com', // QQ邮箱的SMTP服务器地址
    port: 465,           // SSL加密端口
    secure: true,        // 使用SSL
    auth: {
      user: process.env.QQ_MAIL_USER, // 从 .env 文件读取您的QQ邮箱地址
      pass: process.env.QQ_MAIL_PASS, // 从 .env 文件读取您的16位授权码
    },
  });

  console.log('📧 QQ Mail Transporter has been configured.');
  return transporter;
}

async function sendReminderEmail(toEmail, event) {
  // 确保我们的环境变量已经配置
  if (!process.env.QQ_MAIL_USER || !process.env.QQ_MAIL_PASS) {
    console.error('错误：请在 .env 文件中配置 QQ_MAIL_USER 和 QQ_MAIL_PASS');
    return;
  }

  const mailer = await getTransporter();

  const info = await mailer.sendMail({
    from: `"${'智能日程助理'}" <${process.env.QQ_MAIL_USER}>`, // 发件人显示名和您的QQ邮箱
    to: toEmail, // 收件人地址 (用户的邮箱)
    subject: `⏰ 日程提醒: ${event.title}`, // 邮件标题
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>⏰ 日程提醒</h2>
        <p>您好！</p>
        <p>提醒您，您的日程 <strong>"${event.title}"</strong> 即将开始。</p>
        <ul>
          <li><strong>描述:</strong> ${event.description || '无'}</li>
          <li><strong>开始时间:</strong> ${new Date(event.startTime).toLocaleString()}</li>
          <li><strong>结束时间:</strong> ${new Date(event.endTime).toLocaleString()}</li>
        </ul>
        <p>祝您一切顺利！</p>
      </div>
    `, // HTML 格式的内容
  });

  console.log('邮件已发送至 %s: %s', toEmail, info.messageId);
}

module.exports = { sendReminderEmail };