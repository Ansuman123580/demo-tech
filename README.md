# Neural Nuance

A responsive landing page based on components in the supplied Awwwards Motion Pack. The hero uses the original WebGL & ThreeJS Effects/15 Glassform animation. The premium electronics categories are followed by Grid Animations/3 V03, integrated directly into the page so its scroll motion follows the main page scroll.

The five category controls filter products directly inside the V03 animated grid. `offers.json` includes clearly marked sample demo picks for the storefront preview; replace their ordinary product-search links with real affiliate links before launch. Products can be posted with the compact form beneath the grid and are saved by the local server in `offers.json`; clicks pass through `/go/<id>` for click counting before redirecting.

The footer uses the supplied Hover Effects/13 interactive ASCII logo animation, adapted to the Perkdrop wordmark and scoped to the footer. Its original source files are archived under `motion-pack/source/hover-effects-13-1/`.

Run `python3 server.py` and open the local address printed by the server. The V03 animation libraries and image assets load locally; the original animation code is unchanged.

Selected component files are archived under `motion-pack/source/`.
