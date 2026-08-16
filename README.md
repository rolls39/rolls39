# rolls39

Dice to a BIP-39 seed phrase, with every step shown in a form you can check by hand.

**[rolls39.com](https://rolls39.com)** explains what the tool is for and who it is for.
This file covers the repository.

## What is here

`rolls39.html` is the tool. One file, no dependencies, no build step, no network calls.
It runs from disk with the machine offline, which is the way it is meant to be used.

The tool takes dice rolls, hashes them with SHA-256, and converts the digest into a
BIP-39 phrase. It shows the arithmetic at each step and gives you the means to reproduce
every step yourself: the hash with a utility already on your computer, the hex to bits
mapping against a printed table, and each of the twenty-four words against the wordlist.

It derives no addresses. There is no elliptic curve code, no BIP-32, no BIP-44, and no
network access of any kind. That absence is what keeps the file short enough for one
person to read in an afternoon and confirm there is nowhere for a secret to leak.

## Getting the file

Take it from a **tagged release**, never from a clone of `main`:

    https://github.com/rolls39/rolls39/releases

Each release page shows GitHub's own SHA-256 for the asset, computed at upload time.
[rolls39.com](https://rolls39.com) prints the same digest for the current version. Hash
your copy and confirm it matches both before you open it.

Releases are immutable. Assets cannot be replaced or deleted and tags cannot be moved,
so a published digest stays true. Each release carries a Sigstore attestation recorded in
a public transparency log:

    gh release verify-asset <tag> rolls39.html --repo rolls39/rolls39

That check does not depend on GitHub being honest, since it verifies against the log
rather than against this site.

`main` moves. The digest published for a release describes that release, and nothing
else.

## Layout

    rolls39.html      the tool
    test-core.js      conversion tests, lifted out of the HTML and run in Node
    test-mode.js      simple mode and full mode behavior
    fuzz.js           randomized comparison against a reference implementation
    docs/             the rolls39.com landing page, served by GitHub Pages
    img/              figures used by the landing page
    package.json      test harness only, the tool itself has no dependencies

## Running the tests

    npm install
    npm test

Three suites run against the conversion code and the markup. `npm test` prints the
assertion counts.

`test-core.js` lifts the code between the `//<core>` and `//</core>` markers out of the
HTML and evaluates it in Node, so the tests exercise the same bytes that ship. It checks
SHA-256 against Node's own implementation across padding boundaries, checks the wordlist
against its published hash, and checks the full set of English BIP-39 test vectors from
`trezor/python-mnemonic`.

`test-mode.js` covers the two interface modes and the structural expectations of the
markup.

`fuzz.js` compares randomized roll strings against the `bip39` package.

The core has no DOM access, which is what makes lifting it possible. Keep it that way.

## Editing the tool

Anything between `//<core>` and `//</core>` is the conversion. Changes there move the
digest a given set of rolls produces, so treat that region as load bearing and confirm
the same rolls give the same phrase before and after.

`rolls39.html` carries its own version and license in a header comment and a visible
footer line. It states no digest of itself, because a file cannot contain its own hash.
Both version strings have to be updated together.

Changing `rolls39.html` at all means a new version, a new release, and a new digest on
the landing page. The digest is asserted in several independent places and they only
agree because somebody keeps them agreeing.

## The /docs rule

**`rolls39.html` must never be placed in `/docs`.**

`/docs` is published by GitHub Pages. The moment the tool is in there, a live URL opens
it in a browser, and the path through a verified download stops being the only path. The
tool lives at the repository root and ships through tagged releases.

The landing page and its images are the only things in `/docs`.

## Reporting problems

Open an issue. Never include a seed phrase, a set of dice rolls, or any part of either.
Rolls are a seed in another form.

## License

MIT. See [LICENSE](LICENSE).

Copyright (c) 2026 punspotter.
