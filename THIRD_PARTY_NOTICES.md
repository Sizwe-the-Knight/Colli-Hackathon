# Third-party and artwork notices

Review date: 26 October 2026. Colli's MIT grant is limited to original
founder-authored contributions; it does not relicense the material below.

## Committed UI/scaffolding

The `artifacts/colli` component library uses shadcn/ui-derived components and hooks,
with its `components.json` registry configuration. The unused mockup sandbox was
removed from the current tree; its historical upstream notices still apply.
Attribute those portions to shadcn rather than presenting them as
original Colli work. Their upstream MIT notice follows, from the
[shadcn/ui license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md):

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The founder confirms Colli began as their own Replit project and was not knowingly
copied from a restricted project/template. The running button/badge APIs were
retained; uncertain platform variant additions were replaced with attributable
shadcn variants in release candidate ab14977. Upstream references:
[button](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/button.tsx),
[badge](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/badge.tsx).
The uncertain preview scaffold and all earlier private revisions are absent from
this fresh-history snapshot; the founder does not relicense that excluded material.

## Dependencies and excluded Replit packages

This snapshot removes the unused connectors SDK and Replit-only Vite integrations
whose license metadata was unresolved: @replit/connectors-sdk@0.4.1,
@replit/vite-plugin-cartographer@0.5.21, @replit/vite-plugin-dev-banner@0.1.2,
and @replit/vite-plugin-runtime-error-modal@0.0.6. Their imports, direct dependency
references, catalog entries and package/snapshot lock records are removed here.
No installed package code or development bundle is included. Ordinary Vite/React
and Tailwind tooling remain; no replacement package was added.

Other dependencies retain their own licenses (including MIT, Apache-2.0, ISC and
Unlicense). Package manifests and lockfile references do not make dependency code
founder-owned. Preserve applicable upstream LICENSE/NOTICE files when separately
distributing packages or compiled bundles. This source release is not a complete
transitive binary-distribution license audit.

## Colli artwork and fonts

The founder identifies the logo as **founder-directed, AI-assisted artwork**:

- `attached_assets/Colli_Icon_v.2_(2026)_1784464617150.png` — approved source artwork.
- `artifacts/colli/public/colli-icon.png` — application icon.
- `artifacts/colli/public/favicon-16.png` and `favicon-32.png` — favicon derivatives.

This records provenance, not trademark registration, exclusive copyright, or a
guarantee that AI output is copyrightable. These assets are outside the source-code
MIT license. On 26 October the founder approved public use in Colli, its GitHub
repository and hackathon materials. That approval does not license third-party
artwork or grant independent logo reuse rights to other projects.

Inter is fetched from Google Fonts; no font binary is committed. Its upstream
[SIL Open Font License](https://github.com/rsms/inter/blob/master/LICENSE.txt) remains
separate. Provider names and installed icon libraries are not original Colli artwork.
