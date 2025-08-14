# Velocity Marketing Website

A marketing website for Velocity Marketing built with Astro.

## Contact Form with Resend

This project uses [Resend](https://resend.com) to handle contact form submissions. Follow these steps to set it up:

1. **Create a Resend Account**
   - Sign up at [resend.com](https://resend.com)
   - Verify your domain in the Resend dashboard
   - Create an API key

2. **Configure Environment Variables**
   - The project includes a `.env` file template
   - Update the following variables in the `.env` file:
     ```
     RESEND_API_KEY=your_api_key_here
     SEND_EMAIL_FROM=noreply@yourdomain.com
     ```
   - Make sure to use your verified domain for the `SEND_EMAIL_FROM` variable

3. **Install Dependencies**
   - Run `npm install` to install the Resend SDK

4. **Test the Contact Form**
   - Start the development server with `npm run dev`
   - Fill out and submit the contact form
   - Check that emails are being sent successfully

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
