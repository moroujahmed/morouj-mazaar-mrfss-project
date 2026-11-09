# Static interface prototype

| Page | Purpose |
| :--- | :--- |
| [`index.html`](index.html) | Portal launcher and palette overview |
| [`customer.html`](customer.html) | Menu, basket, checkout, payment and tracking |
| [`kitchen.html`](kitchen.html) | Ticket queue, COD accept, bump, 86 toggles and print |
| [`admin.html`](admin.html) | Analytics, orders, inventory, menu, delivery and reports |
| [`rider.html`](rider.html) | Active delivery, PIN handover and offline-safe sync |
| [`design-system.html`](design-system.html) | Tokens, components and contrast rules |

Open `index.html` directly, or serve the folder:

```bash
cd site
python -m http.server 8000
```

No build step and no package installation. Google Fonts is the only external request. All data, payments, and sync states are local demo behaviour.

The canonical system is documented in [`../docs/DESIGN_SYSTEM_V2.md`](../docs/DESIGN_SYSTEM_V2.md). The old [`ui-kit.html`](ui-kit.html) is an archived, non-normative design exploration.
