# news-image-20261121

[![make.fun](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/leoether/news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/leoether/news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121)

A [make.fun](https://make.fun/bounty/news-image-20261121) entry for the
competition **"Sum up 21 November's world news in one image"**.

`main.ts` (Node 22, standard library only) deterministically draws a
1024x1024 newspaper front page — **THE WORLD TODAY, Saturday 21 November
2026** — and writes it to `/output/entry.png`. No network, no clock, no
randomness: two runs produce byte-identical output.

The front page covers the day's news:

- **Lead:** Russia's overnight missile and drone strikes hit three Kyiv
  bridges — at least 9 killed, dozens hurt.
- **Markets:** Wall Street rout as the AI sell-off deepens — Nasdaq
  -5.3%, Dow -950, Nvidia about -14%; the SEC is reported to be
  probing Nvidia's accounting.
- **Cyberattack:** JPMorgan, Visa and Mastercard report attacks on
  third-party vendors; core payment networks unaffected.
- **Climate:** COP31 talks in Turkey enter their crucial final stage.
- **Europe:** Estonia shuts every border crossing with Russia after a
  suspected arson sabotage.
- **Cricket:** India fight back in Wellington — 159/1 on day two of
  the first Test against New Zealand.
- **Also:** Sensex jumps 898 points and the NSE becomes the world's
  5th-largest listed exchange; Hyundai unveils the 2027 Elantra at the
  Los Angeles Auto Show; Trump and Xi agree humans must stay in charge
  of military AI.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024 PNG, under 1 MiB).

## License

MIT — see [LICENSE](LICENSE).
