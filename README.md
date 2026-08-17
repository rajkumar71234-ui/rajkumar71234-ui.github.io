# Minimal Wealth Advisory Pvt Ltd

Static marketing site. No build step, no dependencies — plain HTML, CSS and vanilla JS.

## Pages
| File | Purpose |
|---|---|
| `index.html` | Home |
| `about.html` | About us / Why us |
| `solutions.html` | Five solution categories |
| `team.html` | Founder, the Thirukkural, the team |
| `scan.html` | Portfolio scan intake form (quick / detailed) |
| `calculator.html` | Goal calculator |
| `contact.html` | Contact details and enquiry form |
| `thanks.html` | Post-submission page |

## Hosting
Served by GitHub Pages from the `main` branch, root folder.

## Forms
Both forms post to [FormSubmit](https://formsubmit.co), which is free and accepts file
attachments. The first submission from each form sends an activation link to the owner's
inbox — it must be clicked once before submissions start arriving.

## Things still to fill in before launch
- Real phone number, WhatsApp number and office address (`contact.html`, footer on `index.html`)
- CIN, AMFI ARN and SEBI registration in the footer
- The fee model answer in the Contact FAQ
- Real client testimonials on the home page (currently `[Client name]` samples)
- Two team member names on `team.html`
- Return assumptions in `assets/js/calc.js` / `calculator.html` — review before launch
