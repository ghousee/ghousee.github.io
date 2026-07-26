# Ghouse Mohiuddin Mohammed — Portfolio

Personal portfolio site. Live at **https://ghousee.github.io**

Full-stack developer working across data pipelines, cloud, and ML/AI. This site
presents a few projects as short case studies, each leading with outcomes and
numbers, with the technical detail underneath.

## Case studies
- **Apex Mobile Media** — a data pipeline platform (400M+ row Redshift warehouse)
  and a FastAPI + React analytics app, with a hot/cold two-tier architecture.
- **Flight Refund RAG** — a local, citation-grounded retrieval-augmented
  generation system over airline and government policy.
- **ASL & Speech Translator** — real-time sign recognition plus speech
  translation across 100+ languages.
- **Payroll Management System** — a complete C# / .NET desktop app over MySQL.
- **System Design** — relational ERD and object-oriented UML work.

## Tech
- Plain HTML, CSS, and vanilla JavaScript. No build step.
- [three.js](https://threejs.org) (loaded from a CDN) for the 3D hero, the
  interactive journey timeline, and a hidden arcade.
- Hosted on GitHub Pages.

Everything is progressive: content renders instantly as HTML, and the 3D layers
load lazily and degrade gracefully under reduced-motion, no-WebGL, or on mobile.

## Structure
```
index.html        landing page
assets/           style.css, JavaScript, images, resume
work/             case-study pages
```

## Run locally
It is a static site, so any local server works:
```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Contact
- Email: mgmohiuddin2001@gmail.com
- LinkedIn: https://www.linkedin.com/in/ghouse-mohiuddin-mohammed/
- GitHub: https://github.com/ghousee
