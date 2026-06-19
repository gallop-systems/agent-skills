# Changelog

## [1.16.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.15.0...agent-skills-v1.16.0) (2026-06-19)


### Features

* **copier-template:** autonomous descendant-update procedure ([#51](https://github.com/gallop-systems/agent-skills/issues/51)) ([4b446a7](https://github.com/gallop-systems/agent-skills/commit/4b446a79e36380316b62a6a5ef223770b69afe38))

## [1.15.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.14.0...agent-skills-v1.15.0) (2026-06-19)


### Features

* **kysely-postgres:** document the idempotent seeding pattern ([#48](https://github.com/gallop-systems/agent-skills/issues/48)) ([8af65da](https://github.com/gallop-systems/agent-skills/commit/8af65daeff30929dbbe2c216c7ebcc0aa86a9939))


### Code Refactoring

* **kysely-postgres:** split SKILL.md into topic guides ([#49](https://github.com/gallop-systems/agent-skills/issues/49)) ([7afe869](https://github.com/gallop-systems/agent-skills/commit/7afe869f2339599524620f4f2a54c87d80dd0264))

## [1.14.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.13.0...agent-skills-v1.14.0) (2026-06-18)


### Features

* **kysely-postgres:** prefer eb callback over raw sql in predicate helpers ([#46](https://github.com/gallop-systems/agent-skills/issues/46)) ([dba2a55](https://github.com/gallop-systems/agent-skills/commit/dba2a55325d90ed4133292772fa6699f9240a2c3))

## [1.13.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.12.0...agent-skills-v1.13.0) (2026-06-18)


### Features

* **kysely-postgres:** document append-only migration ordering and prod ledger recovery ([#45](https://github.com/gallop-systems/agent-skills/issues/45)) ([60f2076](https://github.com/gallop-systems/agent-skills/commit/60f20769e1f9960ce060408bf9c30f13dc1eb301))


### Bug Fixes

* **doctl:** clarify DO managed-PG sslmode trap for bound DATABASE_URL ([#43](https://github.com/gallop-systems/agent-skills/issues/43)) ([6d8bdfa](https://github.com/gallop-systems/agent-skills/commit/6d8bdfa19d43ee4c041373977fc76ea5cad43b43))

## [1.12.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.11.0...agent-skills-v1.12.0) (2026-06-15)


### Features

* **nuxt-testing:** capture route and lifecycle test guidance ([#41](https://github.com/gallop-systems/agent-skills/issues/41)) ([408e5ea](https://github.com/gallop-systems/agent-skills/commit/408e5ea6a4d182aae37ea6b288b1eee0ff1a1905))

## [1.11.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.10.0...agent-skills-v1.11.0) (2026-06-15)


### Features

* **contribute-skill:** ship as its own plugin (skill-only); drop legacy command and dead "all" manifest ([#40](https://github.com/gallop-systems/agent-skills/issues/40)) ([c7dbcd0](https://github.com/gallop-systems/agent-skills/commit/c7dbcd0a8a600c9debcdc7fecddd77b8744ad40c))
* **scripts:** support Codex by linking skills into .agents ([#38](https://github.com/gallop-systems/agent-skills/issues/38)) ([3849e9b](https://github.com/gallop-systems/agent-skills/commit/3849e9befbbbc0f3c82cbc58e883ab85b598f74b))

## [1.10.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.9.0...agent-skills-v1.10.0) (2026-06-15)


### Features

* **nitro-testing:** add frontend gotchas for stubs, routes, composables, fetch cache ([#36](https://github.com/gallop-systems/agent-skills/issues/36)) ([08abd5c](https://github.com/gallop-systems/agent-skills/commit/08abd5c291cc4091471a70adf19142b5edf9af03))
* **vue-nuxt:** sharpen derive-state rule and add VueUse SSR/URL gotchas ([#35](https://github.com/gallop-systems/agent-skills/issues/35)) ([28f5680](https://github.com/gallop-systems/agent-skills/commit/28f5680bb99a2779be5cb0a4d30cbd499cd50460))

## [1.9.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.8.0...agent-skills-v1.9.0) (2026-06-15)


### Features

* **vue-nuxt:** add VueUse skill, prefer composables over hand-rolled watch effects ([#34](https://github.com/gallop-systems/agent-skills/issues/34)) ([f20397d](https://github.com/gallop-systems/agent-skills/commit/f20397d83e1e38f69c2b83bd28968a3c5ab1fa39))


### Documentation

* **copier-template:** document branch protection setup for descendants ([#32](https://github.com/gallop-systems/agent-skills/issues/32)) ([3e541ee](https://github.com/gallop-systems/agent-skills/commit/3e541eec37a7c86911b9ebf74d20cba2d14b8175))

## [1.8.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.7.0...agent-skills-v1.8.0) (2026-06-14)


### Features

* **tailwind-v4:** add Tailwind v4 skill; audit zod v3-&gt;v4 in nuxt-nitro-api ([9bc3486](https://github.com/gallop-systems/agent-skills/commit/9bc3486bdea2e5769222d903e9ec3b559a08fd40))
* **tailwind-v4:** Tailwind v4 skill + zod v3→v4 audit ([#30](https://github.com/gallop-systems/agent-skills/issues/30)) ([9bc3486](https://github.com/gallop-systems/agent-skills/commit/9bc3486bdea2e5769222d903e9ec3b559a08fd40))

## [1.7.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.6.1...agent-skills-v1.7.0) (2026-06-14)


### Features

* **kysely-postgres:** window functions, set ops, lateral joins, locking, FTS ([#28](https://github.com/gallop-systems/agent-skills/issues/28)) ([046a392](https://github.com/gallop-systems/agent-skills/commit/046a39234308cf34d42ace29cab4b6f79cb43fcf))

## [1.6.1](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.6.0...agent-skills-v1.6.1) (2026-06-14)


### Code Refactoring

* **skills:** move page-structure + formatters from nuxt-nitro-api to vue-nuxt ([#24](https://github.com/gallop-systems/agent-skills/issues/24)) ([cbbbeb3](https://github.com/gallop-systems/agent-skills/commit/cbbbeb356f100bc61a5613549159227045f5d540))
* **skills:** move page-structure + formatters to vue-nuxt ([cbbbeb3](https://github.com/gallop-systems/agent-skills/commit/cbbbeb356f100bc61a5613549159227045f5d540))


### Continuous Integration

* **release-please:** release on every conventional type except chore ([#25](https://github.com/gallop-systems/agent-skills/issues/25)) ([8ea6953](https://github.com/gallop-systems/agent-skills/commit/8ea695313f76c477e7bf0eb6b45b29b4250039ca))

## [1.6.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.5.0...agent-skills-v1.6.0) (2026-06-14)


### Features

* **nuxt-nitro-api:** Nitro v2 pin + state/error/caching/storage/route-rules references ([#20](https://github.com/gallop-systems/agent-skills/issues/20)) ([b5fe249](https://github.com/gallop-systems/agent-skills/commit/b5fe249bdeda0e25d3f5c3659dcdb7d3a0ce50e3))
* **volt-primevue:** correct vendoring framing; add pt/state/config references ([#21](https://github.com/gallop-systems/agent-skills/issues/21)) ([ac02720](https://github.com/gallop-systems/agent-skills/commit/ac0272014bccceaf7a529f7647ec2ee0b35dba52))
* **vue-nuxt:** add skill + frontend nuggets for nuxt-nitro-api ([#19](https://github.com/gallop-systems/agent-skills/issues/19)) ([34c796c](https://github.com/gallop-systems/agent-skills/commit/34c796c637a31e95a29558280196b0c92455ece2))

## [1.5.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.4.0...agent-skills-v1.5.0) (2026-06-14)


### Features

* Add volt-primevue skill ([#17](https://github.com/gallop-systems/agent-skills/issues/17)) ([dc04c61](https://github.com/gallop-systems/agent-skills/commit/dc04c61e75ea3e8c76bc40c30ce25c3eb8b50051))

## [1.4.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.3.0...agent-skills-v1.4.0) (2026-06-12)


### Features

* **nuxt-nitro-api:** add formatters reference ([#15](https://github.com/gallop-systems/agent-skills/issues/15)) ([4e59f2c](https://github.com/gallop-systems/agent-skills/commit/4e59f2cc907d1121baf39bb044fb3aef5ba8fa79))

## [1.3.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.2.0...agent-skills-v1.3.0) (2026-06-09)


### Features

* contribute-back loop — /contribute-skill command and skill footers ([a9e4f3b](https://github.com/gallop-systems/agent-skills/commit/a9e4f3b68a43c2ec6e123355d98604cf274cef77))
* contribute-back loop with /contribute-skill command and skill footers ([#13](https://github.com/gallop-systems/agent-skills/issues/13)) ([a9e4f3b](https://github.com/gallop-systems/agent-skills/commit/a9e4f3b68a43c2ec6e123355d98604cf274cef77))

## [1.2.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.1.0...agent-skills-v1.2.0) (2026-06-09)


### Features

* add git-github and copier-template skills, expand doctl skill ([#10](https://github.com/gallop-systems/agent-skills/issues/10)) ([63b9e4f](https://github.com/gallop-systems/agent-skills/commit/63b9e4ff8985d9e2d0ceb69ec614920ade316b1e))

## [1.1.0](https://github.com/gallop-systems/agent-skills/compare/agent-skills-v1.0.2...agent-skills-v1.1.0) (2026-06-03)


### Features

* distribute skills as an npm package ([63ece19](https://github.com/gallop-systems/agent-skills/commit/63ece191bf4d14ae7856817df5169ffa7c80376e))
