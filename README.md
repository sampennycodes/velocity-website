# Velocity Marketing Website

A marketing website for Velocity Marketing built with Astro.

## Contact Form with Resend ✅

The contact form is now **FULLY INTEGRATED with Resend** and will actually send emails! This uses Astro's built-in API routes with the Vercel adapter for both local development and production deployment.

### Setup Instructions:

1. **Get Your Resend API Key**
   - Sign up at [resend.com](https://resend.com)
   - Verify your domain in the Resend dashboard
   - Create an API key

2. **Configure Environment Variables**
   - Add the following variables to your existing `.env` file:
     ```
     RESEND_API_KEY=your_actual_api_key_here
     SEND_EMAIL_FROM=noreply@yourdomain.com
     ```
   - Use your verified domain for `SEND_EMAIL_FROM`

3. **Local Development**
   - Run `npm run dev` to start the development server
   - The contact form will work locally with your Resend API key

4. **Vercel Deployment**
   - The project is configured with `@astrojs/vercel` adapter
   - Add your environment variables in Vercel dashboard:
     - Go to your project settings → Environment Variables
     - Add `RESEND_API_KEY` and `SEND_EMAIL_FROM`
   - Deploy with `vercel --prod` or push to your connected Git repository

5. **Test the Contact Form**
   - Fill out and submit the contact form
   - Check that emails are being sent to mike@velocitymarketing.com.au

### Features:
- ✅ **Fully functional contact form** with Resend integration
- ✅ **Server-side validation** and error handling
- ✅ **Honeypot protection** against spam bots
- ✅ **Professional email templates** (HTML + text)
- ✅ **Proper error handling** and user feedback
- ✅ **Accessibility features** with ARIA labels and error descriptions
- ✅ **Works locally and in production** with Vercel adapter
- ✅ **Proper Vercel serverless function configuration**

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

**Key Files:**
- `src/pages/index.astro` - Main page with contact form
- `src/pages/api/contact.ts` - API endpoint for Resend integration
- `astro.config.mjs` - Astro configuration with Vercel adapter
- `vercel.json` - Vercel deployment configuration
- `.env` - Environment variables for Resend API key

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🚨 Troubleshooting

### Common Issues:

1. **"Cannot find module" errors in Vercel**
   - Ensure you're using `output: 'server'` in `astro.config.mjs`
   - Verify the `@astrojs/vercel` adapter is properly configured
   - Check that your environment variables are set in Vercel dashboard

2. **Contact form not sending emails**
   - Verify your `RESEND_API_KEY` is correct
   - Ensure `SEND_EMAIL_FROM` uses a verified domain in Resend
   - Check Vercel function logs for any API errors

3. **Build errors**
   - Run `npm run build` locally to catch issues before deployment
   - Ensure all dependencies are installed with `npm install`

### Environment Variables in Vercel:
- Go to your Vercel project dashboard
- Navigate to Settings → Environment Variables
- Add:
  - `RESEND_API_KEY` = your actual Resend API key
  - `SEND_EMAIL_FROM` = your verified domain (e.g., noreply@yourdomain.com)

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
