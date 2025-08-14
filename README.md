# Velocity Marketing Website

A marketing website for Velocity Marketing built with Astro.

## Contact Form with Resend ✅

The contact form is now **FULLY INTEGRATED with Resend** and will actually send emails! This uses Astro's built-in API routes with the Node adapter for both local development and production.

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

4. **Production Deployment**
   - Deploy to any Node.js hosting service (Vercel, Netlify, Railway, etc.)
   - Add your environment variables to your hosting platform
   - The contact form will work in production

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
- ✅ **Works locally and in production** with Node.js adapter

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

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
