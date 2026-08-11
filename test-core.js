#!/usr/bin/env node
// rolls39 regression harness.  Usage:  node test-core.js rolls39.html
//
// Lifts the code between the //<core> and //</core> markers out of the HTML and
// runs it in Node, then checks the markup for structural mistakes. The core has
// no DOM access, which is what makes this possible; keep it that way.
"use strict";
const fs = require("fs");
const crypto = require("crypto");

const file = process.argv[2] || "rolls39.html";
const html = fs.readFileSync(file, "utf8");

// ---- lift the core and evaluate it ----
if (html.indexOf("//<core>") < 0 || html.indexOf("//</core>") < 0) {
  console.error("no //<core> markers found in " + file);
  process.exit(2);
}
const core = html.split("//<core>")[1].split("//</core>")[0];
const C = {};
new Function("exports", core + "\nObject.assign(exports,{sha256,ascii,hex,bitsOf,bytesFromHex,mnemonic,fromRolls,WORDS,DICE,faces,dieBits,rollBits,filterRolls,rollCount});")(C);

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (String(got) === String(want)) { pass++; return; }
  fail++;
  console.log("FAIL  " + name + "\n        got " + got + "\n        want " + want);
};

// ---- SHA-256 ----
t("sha256 abc", C.hex(C.sha256(C.ascii("abc"))),
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
t("sha256 empty", C.hex(C.sha256(C.ascii(""))),
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
// padding boundaries: one block, two blocks, and the length-field overflow case
for (const n of [0,1,55,56,57,63,64,65,111,112,113,119,120,1000]) {
  const s = "x".repeat(n);
  t("sha256 padding " + n + "B", C.hex(C.sha256(C.ascii(s))),
    crypto.createHash("sha256").update(s).digest("hex"));
}

// ---- wordlist ----
t("wordlist length", C.WORDS.length, 2048);
t("wordlist hash", C.hex(C.sha256(C.ascii(C.WORDS.join("\n") + "\n"))),
  "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda");
t("first word", C.WORDS[0], "abandon");
t("last word", C.WORDS[2047], "zoo");

// ---- BIP-39 conformance: all 24 English vectors from trezor/python-mnemonic ----
const VECTORS = [
  ["00000000000000000000000000000000","abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"],
  ["7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f","legal winner thank year wave sausage worth useful legal winner thank yellow"],
  ["80808080808080808080808080808080","letter advice cage absurd amount doctor acoustic avoid letter advice cage above"],
  ["ffffffffffffffffffffffffffffffff","zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"],
  ["000000000000000000000000000000000000000000000000","abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon agent"],
  ["7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f","legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal will"],
  ["808080808080808080808080808080808080808080808080","letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter always"],
  ["ffffffffffffffffffffffffffffffffffffffffffffffff","zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo when"],
  ["0000000000000000000000000000000000000000000000000000000000000000","abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"],
  ["7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f","legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title"],
  ["8080808080808080808080808080808080808080808080808080808080808080","letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless"],
  ["ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote"],
  ["9e885d952ad362caeb4efe34a8e91bd2","ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic"],
  ["6610b25967cdcca9d59875f5cb50b0ea75433311869e930b","gravity machine north sort system female filter attitude volume fold club stay feature office ecology stable narrow fog"],
  ["68a79eaca2324873eacc50cb9c6eca8cc68ea5d936f98787c60c7ebc74e6ce7c","hamster diagram private dutch cause delay private meat slide toddler razor book happy fancy gospel tennis maple dilemma loan word shrug inflict delay length"],
  ["c0ba5a8e914111210f2bd131f3d5e08d","scheme spot photo card baby mountain device kick cradle pact join borrow"],
  ["6d9be1ee6ebd27a258115aad99b7317b9c8d28b6d76431c3","horn tenant knee talent sponsor spell gate clip pulse soap slush warm silver nephew swap uncle crack brave"],
  ["9f6a2878b2520799a44ef18bc7df394e7061a224d2c33cd015b157d746869863","panda eyebrow bullet gorilla call smoke muffin taste mesh discover soft ostrich alcohol speed nation flash devote level hobby quick inner drive ghost inside"],
  ["23db8160a31d3e0dca3688ed941adbf3","cat swing flag economy stadium alone churn speed unique patch report train"],
  ["8197a4a47f0425faeaa69deebc05ca29c0a5b5cc76ceacc0","light rule cinnamon wrap drastic word pride squirrel upgrade then income fatal apart sustain crack supply proud access"],
  ["066dca1a2bb7e8a1db2832148ce9933eea0f3ac9548d793112d9a95c9407efad","all hour make first leader extend hole alien behind guard gospel lava path output census museum junior mass reopen famous sing advance salt reform"],
  ["f30f8c1da665478f49b001d94c5fc452","vessel ladder alter error federal sibling chat ability sun glass valve picture"],
  ["c10ec20dc3cd9f652c7fac2f1230f7a3c828389a14392f05","scissors invite lock maple supreme raw rapid void congress muscle digital elegant little brisk hair mango congress clump"],
  ["f585c11aec520db57dd353c69554b21a89b20fb0650966fa0a9d6f74fd989d8f","void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold"]
];
let vok = 0;
for (const [ent, phrase] of VECTORS)
  if (C.mnemonic(C.bytesFromHex(ent)).phrase === phrase) vok++;
t("trezor english vectors", vok, VECTORS.length);

// ---- fixture: 99 rolls ----
const R = "611632226166515411122551526665424531264332231141335316451415365352611623121434632332636661562562244";
t("fixture digest", C.hex(C.fromRolls(R, 24).digest),
  "8616c066396ee300fad86cf5ad083ec46c09d273e389642f35468e92c96730d6");
t("fixture 24 words", C.fromRolls(R, 24).m.phrase,
  "maid render book index until lesson twin assault volcano hair autumn match scene truck sort illness goddess keen faculty brush clutch receive select seek");
t("fixture 12 words", C.fromRolls(R, 12).m.phrase,
  "maid render book index until lesson twin assault volcano hair autumn material");
t("12 and 24 share 11 words",
  C.fromRolls(R, 12).m.phrase.split(" ").slice(0,11).join(" ") ===
  C.fromRolls(R, 24).m.phrase.split(" ").slice(0,11).join(" "), true);
t("non-dice characters filtered",
  C.hex(C.fromRolls("6 1 1x63 2226" + R.slice(9), 24).digest),
  "8616c066396ee300fad86cf5ad083ec46c09d273e389642f35468e92c96730d6");
t("trailing newline changes digest",
  C.hex(C.sha256(C.ascii(R + "\n"))),
  "8dbba55e6e4775851dfc06b665d700992a206ea81c6740860623b016064bdedd");

// ---- structure of the mnemonic at every length ----
const PV = [1024,512,256,128,64,32,16,8,4,2,1];
for (const w of [12,15,18,21,24]) {
  const r = C.fromRolls(R, w);
  const last = r.m.rows[r.m.rows.length - 1];
  t(w + "w row count", r.m.rows.length, w);
  t(w + "w entropy bytes", r.entropy.length, w * 32 / 3 / 8);
  t(w + "w checksum width", last.bits.length - last.csFrom, w / 3);
  t(w + "w checksum bits come from sha256(entropy)",
    last.bits.slice(last.csFrom), C.bitsOf(C.sha256(r.entropy)).slice(0, w / 3));
  let ok = true;
  for (const row of r.m.rows) {
    let s = 0;
    for (let k = 0; k < 11; k++) if (row.bits.charAt(k) === "1") s += PV[k];
    if (s !== row.idx || C.WORDS[s] !== row.word) ok = false;
  }
  t(w + "w place values sum to index and word", ok, true);
}
t("checksum digest 12w", C.hex(C.sha256(C.fromRolls(R,12).entropy)),
  "7568d6d3f5d96f9143eae0db100548e848e2c4567b6c590bd79a001c1ea3abb5");
t("checksum digest 24w", C.hex(C.sha256(C.fromRolls(R,24).entropy)),
  "18cb30dbf8762f6f77c98e47420fd92546330bdbe774d864a2ceac8b0415e63d");
t("row 1 of fixture", C.fromRolls(R,24).m.rows[0].idx + " " + C.fromRolls(R,24).m.rows[0].word,
  "1072 maid");
t("hashing hex as text differs from hashing bytes",
  C.hex(C.sha256(C.ascii(C.hex(C.fromRolls(R,12).entropy)))) !==
  C.hex(C.sha256(C.fromRolls(R,12).entropy)), true);

// ---- die types ----
// d6 must behave exactly as it did before the table existed
t("d6 default: fixture digest unchanged", C.hex(C.fromRolls(R, 24).digest),
  "8616c066396ee300fad86cf5ad083ec46c09d273e389642f35468e92c96730d6");
t("d6 explicit equals d6 default", C.hex(C.fromRolls(R, 24, "d6").digest), C.hex(C.fromRolls(R, 24).digest));
t("d6 filter equals the original character class",
  C.filterRolls("6 1 1x63 2226" + R.slice(9), "d6"), R);
t("d6 roll count is the string length", C.rollCount(R, "d6"), 99);

const FACE_COUNT = { d4: 4, d6: 6, d8: 8 };
t("the die table holds the expected types", Object.keys(C.DICE).join(","), "d4,d6,d8");
for (const [k, n] of Object.entries(FACE_COUNT)) {
  const f = C.faces(k);
  t(k + " face count", f.length, n);
  t(k + " every face is one character", f.every(x => x.length === 1), true);
  t(k + " faces are distinct", new Set(f).size, n);
  t(k + " faces run 1 to n", f.join(","), Array.from({ length: n }, (_, i) => i + 1).join(","));
  t(k + " zero is not a face", f.indexOf("0"), -1);
  t(k + " fair bits", C.dieBits(k).toFixed(4), Math.log2(n).toFixed(4));
  t(k + " roll count equals string length", C.rollCount(f.join(""), k), n);
}
t("d4 faces", C.faces("d4").join(","), "1,2,3,4");
t("d6 faces", C.faces("d6").join(","), "1,2,3,4,5,6");
t("d8 faces", C.faces("d8").join(","), "1,2,3,4,5,6,7,8");
t("no die reaches past 9, so one roll is always one character",
  Object.values(C.DICE).every(d => d.n <= 9), true);

// the imbalance cost is log2(1+e) and does not depend on the die, which is what lets
// one setting carry a fixed bits figure for every type
const IMB = [0, 0.05, 0.10, 0.20, 0.50];
let penaltyConstant = true, penaltyRight = true;
for (const e of IMB) {
  const costs = Object.keys(FACE_COUNT).map(k => C.dieBits(k) - C.rollBits(k, e));
  if (Math.max(...costs) - Math.min(...costs) > 1e-12) penaltyConstant = false;
  if (Math.abs(costs[0] - Math.log2(1 + e)) > 1e-12) penaltyRight = false;
}
t("the imbalance cost is the same for every die", penaltyConstant, true);
t("the imbalance cost is log2(1+e)", penaltyRight, true);
t("fair costs nothing", C.rollBits("d6", 0).toFixed(4), Math.log2(6).toFixed(4));
// the labels shipped in the markup must match the arithmetic, checked against the
// markup itself so the two cannot drift
const imbOpts = [...html.matchAll(/<option value="(0(?:\.\d+)?)"[^>]*>([^<]*)<\/option>/g)]
  .map(m => ({ e: +m[1], label: m[2] }));
t("the imbalance menu ships five options", imbOpts.length, 5);
for (const o2 of imbOpts) {
  if (o2.e === 0) { t("fair option claims no cost", /no cost/.test(o2.label), true); continue; }
  const pct = /\+(\d+)%/.exec(o2.label), bits = /-(\d\.\d+) bits/.exec(o2.label);
  t("imbalance option " + o2.label + " states its own percentage",
    pct ? +pct[1] / 100 : null, o2.e);
  t("imbalance option " + o2.label + " states the right cost",
    bits ? bits[1] : "none", Math.log2(1 + o2.e).toFixed(3));
}
const dieOpts = [...html.matchAll(/<option value="(d\d+)"[^>]*>([^<]*)<\/option>/g)]
  .map(m => ({ k: m[1], label: m[2] }));
t("the die menu ships one option per table entry", dieOpts.length, Object.keys(C.DICE).length);
for (const o2 of dieOpts) {
  const bits = /(\d\.\d\d\d) bits/.exec(o2.label);
  t("die option " + o2.k + " states its fair bits",
    bits ? bits[1] : "none", C.dieBits(o2.k).toFixed(3));
  const rng = /faces (\d)-(\d)/.exec(o2.label), f = C.faces(o2.k);
  t("die option " + o2.k + " states its face range",
    rng ? rng[1] + "-" + rng[2] : "none", f[0] + "-" + f[f.length - 1]);
}
t("d6 at +20% is the old p_max 0.20", ((1 + 0.20) / 6).toFixed(10), (0.20).toFixed(10));
t("d6 at +20% still asks for 111 rolls at 24 words",
  Math.ceil(256 / C.rollBits("d6", 0.20)), 111);
t("d6 fair asks for 100 rolls at 24 words", Math.ceil(256 / C.rollBits("d6", 0)), 100);
t("d8 at +20% asks for 94 rolls at 24 words", Math.ceil(256 / C.rollBits("d8", 0.20)), 94);
t("d4 at +20% asks for 148 rolls at 24 words", Math.ceil(256 / C.rollBits("d4", 0.20)), 148);

// filtering: every die rejects 0, and each rejects everything above its own top face
t("d6 filter drops a 7", C.filterRolls("1234567", "d6"), "123456");
t("d4 filter drops a 5", C.filterRolls("12345", "d4"), "1234");
t("d8 filter keeps an 8", C.filterRolls("1238", "d8"), "1238");
t("d8 filter drops a 9", C.filterRolls("1289", "d8"), "128");
for (const k of Object.keys(FACE_COUNT)) {
  t(k + " filter drops a 0", C.filterRolls("10203", k), "123");
  t(k + " filter drops letters and spaces", C.filterRolls("1 2\n3x", k), "123");
  t(k + " filter drops every digit above its top face",
    C.filterRolls("123456789", k), C.faces(k).join(""));
}
// per character of roll string, which is what the die list is limited by
t("bits per character, d4 to d8",
  ["d4", "d6", "d8"].map(k => C.dieBits(k).toFixed(3)).join(" "), "2.000 2.585 3.000");
t("a two-digit d16 would be worth less per character than a d6",
  (4 / 2) < C.dieBits("d6"), true);
// the die changes the accounting, never the mapping: same string, same digest
t("the digest depends on the string and not the die",
  C.hex(C.fromRolls("123456", 24, "d6").digest), C.hex(C.fromRolls("123456", 24, "d8").digest));
t("a d8 roll string produces a valid phrase",
  C.fromRolls(C.faces("d8").join("").repeat(12), 24, "d8").m.rows.length, 24);
t("core exposes the die helpers without DOM access",
  typeof C.rollBits === "function" && typeof C.faces === "function", true);

const diceOpts = /<select id="dice">([\s\S]*?)<\/select>/.exec(html);
const diceVals = diceOpts ? [...diceOpts[1].matchAll(/<option[^>]*>(\d+)</g)].map(m => +m[1]) : [];
t("dice per throw runs 1 to 10 with no gaps",
  diceVals.join(","), Array.from({ length: 10 }, (_, i) => i + 1).join(","));
t("dice per throw defaults to five", /<option selected>5<\/option>/.test(diceOpts ? diceOpts[1] : ""), true);

// ---- structural checks on the markup ----
const markup = html.slice(0, html.indexOf("<script>"));
const js = html.split("<script>")[1].split("</script>")[0];
const ids = new Set([...markup.matchAll(/id="(\w+)"/g)].map(m => m[1]));
const refs = new Set([
  ...[...js.matchAll(/\$\("(\w+)"\)/g)].map(m => m[1]),
  ...[...js.matchAll(/getElementById\("(\w+)"\)/g)].map(m => m[1]),
  ...[...js.matchAll(/"(\w+Sec)"/g)].map(m => m[1])
]);
// the test-mode banner is inserted at runtime rather than declared in the markup
const RUNTIME_IDS = new Set(["testbanner"]);
const missing = [...refs].filter(r => !ids.has(r) && !RUNTIME_IDS.has(r)).sort();
t("every id the script touches exists in the markup", missing.join(",") || "none", "none");

// the setup controls read target, then die, then throw, then credit per roll
const grid = /<div id="gate">([\s\S]*?)<p class="note" id="need">/.exec(markup);
t("setup controls are in reading order",
  grid ? [...grid[1].matchAll(/<select id="(\w+)"/g)].map(m => m[1]).join(",") : "none",
  "words,dieType,pmax,dice");
t("each setup control has a label bound to it",
  grid ? [...grid[1].matchAll(/<select id="(\w+)"/g)].every(m =>
    grid[1].indexOf('for="' + m[1] + '"') >= 0) : false, true);

// the wallet list a phrase is claimed to restore on
const wallets = /restores on ([^.]*?), among others/.exec(markup);
t("the wallet list is present", wallets ? "yes" : "no", "yes");
if (wallets) {
  const w = wallets[1];
  for (const name of ["Trezor", "BitBox", "Ledger", "Coldcard", "Jade"])
    t("the wallet list names " + name, w.indexOf(name) >= 0, true);
  t("Coldcard comes after Ledger", w.indexOf("Coldcard") > w.indexOf("Ledger"), true);
  t("the list is not claimed to be exhaustive", /among others/.test(markup), true);
}

const stages = [...markup.matchAll(/<p class="eyebrow">(\d)\s*&nbsp;/g)].map(m => +m[1]);
t("stage numbers are 1..n with no gaps",
  stages.join(",") , stages.map((_, i) => i + 1).join(","));

const stepRefs = [...markup.matchAll(/step (\d)/g)].map(m => +m[1]);
t("prose never cites a step number above the last stage",
  stepRefs.every(s => s <= Math.max(...stages)), true);

// each presentation in step 4 carries its own subheading, in reading order
const tableSecBody = /<section id="tableSec"[^>]*>([\s\S]*?)<\/section>/.exec(markup);
if (tableSecBody) {
  const body = tableSecBody[1];
  const subs = [...body.matchAll(/<p class="eyebrow"[^>]*>([^<]*)<\/p>/g)].map(m => m[1].trim());
  t("step 4 subheadings, in order", subs.join(" | "),
    "4 &nbsp;digest to words | hex to bits | digest as hex | digest as bits | bits to words | bit calculator");
  // every subheading must sit above the thing it names
  const order = ["hex to bits", "nibs", "digest as hex", "hexOut", "digest as bits", "binOut",
    "bits to words", "tbody", "bit calculator", "calc"];
  let last = -1, ok = true;
  for (const token of order) {
    const at = body.indexOf(token.length > 10 || token.indexOf(" ") >= 0 ? ">" + token + "<" : 'id="' + token + '"');
    if (at < 0 || at < last) ok = false;
    last = at;
  }
  t("each step 4 subheading precedes the element it names", ok, true);
}


// No byte may split across a line. .data carries word-break:break-all, so each
// byte's characters must sit inside one nowrap box. Find the nowrap rule scoped
// to #hexOut, take its class name, and check hexGrouped actually emits it.
const css = /<style>([\s\S]*?)<\/style>/.exec(html);
const hexFn = /function hexGrouped\([\s\S]*?\n\}/.exec(js);
if (css && hexFn) {
  const rule = /#hexOut\s+span\.(\w+)[^{]*\{[^}]*white-space\s*:\s*nowrap/.exec(css[1]);
  t("a nowrap rule exists for a #hexOut wrapper class", rule ? rule[1] : "none", rule ? rule[1] : "some class");
  t("hexGrouped emits that wrapper class",
    rule ? hexFn[0].indexOf('"' + rule[1] + '"') >= 0 : false, true);
}
const binFn = /function group11\([\s\S]*?\n\}/.exec(js);
if (binFn && css) {
  const brule = /#binOut\s+span\.(\w+)[^{]*\{[^}]*white-space\s*:\s*nowrap/.exec(css[1]);
  t("a nowrap rule exists for a #binOut wrapper class", brule ? brule[1] : "none", brule ? brule[1] : "some class");
  t("group11 emits that wrapper class",
    brule ? binFn[0].indexOf("'" + brule[1] + "'") >= 0 : false, true);
}
t("core contains no DOM access",
  /document\.|window\.|getElementById/.test(core) === false, true);

// ---- the file fetches nothing ----
// An offline tool must not reference a remote resource anywhere, and the favicon is the
// easiest place for one to sneak in. Data URI only, so opening from disk makes no request.
{
  const fetchable = [...html.matchAll(/\s(?:src|href|action|poster|srcset|data)="([^"]*)"/g)]
    .map(m => m[1])
    .filter(u => !u.startsWith("#") && !u.startsWith("data:"));
  t("no element points at anything but an anchor or a data URI",
    fetchable.join(", ") || "none", "none");
  t("no scheme-relative or absolute URL in a fetchable attribute",
    /\s(?:src|href|action|poster|srcset)="(?:https?:)?\/\//.test(html), false);
  t("no @import and no url() in the stylesheet",
    css ? /@import|url\(/.test(css[1]) : false, false);

  const icon = /<link rel="icon" type="([^"]+)" href="(data:image\/svg\+xml,[^"]+)">/.exec(html);
  t("there is exactly one favicon", (html.match(/rel="icon"/g) || []).length, 1);
  t("the favicon is an inline svg data URI", icon ? icon[1] : "none", "image/svg+xml");
  if (icon) {
    const svg = decodeURIComponent(icon[2].replace("data:image/svg+xml,", ""));
    t("the favicon svg is closed", /^<svg[\s\S]*<\/svg>$/.test(svg.trim()), true);
    t("the favicon declares a square viewBox", /viewBox='0 0 (\d+) \1'/.test(svg), true);
    // attribute order must not matter, so parse each tag rather than a fixed sequence
    const attrOf = (tag, name) => {
      const m2 = new RegExp("\\b" + name + "='([^']*)'").exec(tag);
      return m2 ? m2[1] : null;
    };
    const circles = [...svg.matchAll(/<circle\b([^>]*?)\/?>/g)].map(m2 => m2[1]);
    t("the favicon shows three pips", circles.length, 3);
    const pts = circles.map(c => [parseFloat(attrOf(c, "cx")), parseFloat(attrOf(c, "cy"))]);
    t("every pip has coordinates and a radius",
      pts.every(pt => isFinite(pt[0]) && isFinite(pt[1])) &&
      circles.every(c => isFinite(parseFloat(attrOf(c, "r")))), true);
    t("every pip is the same size",
      new Set(circles.map(c => attrOf(c, "r"))).size, 1);
    // the pips must sit on a diagonal, which is what makes it read as a die
    if (pts.length === 3) {
      t("the pips are on the diagonal", pts.every(pt => Math.abs(pt[0] - pt[1]) < 0.01), true);
      t("the pips are evenly spaced",
        Math.abs((pts[1][0] - pts[0][0]) - (pts[2][0] - pts[1][0])) < 0.01, true);
      const box = +/viewBox='0 0 (\d+)/.exec(svg)[1];
      t("the middle pip is centred", Math.abs(pts[1][0] - box / 2) < 0.01, true);
    }
    const orange = /--orange:(#[0-9a-f]{6})/.exec(html)[1];
    t("the favicon ground is the header orange", svg.indexOf(orange) >= 0, true);
    t("the favicon ink is the header ink", svg.indexOf("#0a0a0a") >= 0, true);
    t("the favicon carries no colour outside the palette",
      [...new Set([...svg.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0].toLowerCase()))]
        .filter(c => c !== orange && c !== "#0a0a0a").join(",") || "none", "none");
    t("the favicon is small enough to stay inline", svg.length < 1500, true);
  }
}

// ---- simple mode: presentation only, and the surface matches the handoff ----
t("simple mode does not reach into the core",
  /SIMPLE|fullonly|simpleonly/.test(core) === false, true);

// which sections disappear, taken from the script rather than restated here
const hideDecl = /const SIMPLE_HIDE_SECTIONS\s*=\s*\[([^\]]*)\]/.exec(js);
const hidden = hideDecl ? [...hideDecl[1].matchAll(/"(\w+)"/g)].map(m => m[1]) : [];
t("the hide list is declared in one place", hidden.join(",") || "none", "verifySec,tableSec");
t("every section on the hide list exists", hidden.filter(id => !ids.has(id)).join(",") || "none", "none");

// section membership for every id, so a moved element cannot silently change mode
const sections = [...markup.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map(m => {
  const idm = /id="(\w+)"/.exec(m[1]);
  const eb = /<p class="eyebrow">(\d+)\s*&nbsp;/.exec(m[2]);
  return { id: idm ? idm[1] : "(setup)", stage: eb ? +eb[1] : null, body: m[2] };
});
const secOf = {};
for (const s of sections)
  for (const x of s.body.matchAll(/id="(\w+)"/g)) secOf[x[1]] = s.id;
const tagOf = id => {
  const m = new RegExp('<[^<>]*\\bid="' + id + '"[^<>]*>').exec(markup);
  return m ? m[0] : "";
};
const gone = id => hidden.indexOf(secOf[id]) >= 0 || /\bfullonly\b/.test(tagOf(id));

// section 2 of the handoff, "simple mode: the whole surface"
const DROP = ["os","cmd","cmdNote","copyCmd","check","checkOut","vstate","skipVerify",
  "hexOut","binOut","nibs","tbody","truncNote","calc","calcOut","calcClear","csDetails",
  "printSheet","withList","attest","copyFiltered"];
const KEEP = ["dice","words","gate","startReal","startTest","throws","more","reset","stats",
  "meter","need","filtered","fstats","phrase","copyPhrase","selftest"];
t("every id on the drop list exists", DROP.filter(id => !ids.has(id)).join(",") || "none", "none");
t("every id on the keep list exists", KEEP.filter(id => !ids.has(id)).join(",") || "none", "none");
t("nothing on the drop list survives simple mode",
  DROP.filter(id => !gone(id)).join(",") || "none", "none");
t("nothing on the keep list is hidden in simple mode",
  KEEP.filter(id => gone(id)).join(",") || "none", "none");

// the digest is one element moved between two homes, never two elements
t("hexPlain appears once in the markup", (markup.match(/id="hexPlain"/g) || []).length, 1);
t("hexPlain has a home in both modes", ids.has("hexHome") && ids.has("hexSlot"), true);
t("the script relocates hexPlain rather than duplicating it",
  /\(SIMPLE\?\$\("hexSlot"\):\$\("hexHome"\)\)\.appendChild\(\$\("hexPlain"\)\)/.test(js), true);

// the gate differs between modes, and simple mode is the tier-one case
t("the phrase gate branches on the mode",
  /\$\("phraseSec"\)\.classList\.toggle\("locked",SIMPLE\?isShort:!\$\("attest"\)\.checked\)/.test(js), true);

// hiding a stage must not leave a gap in the visible numbering
const kept = sections.filter(s => s.stage !== null && hidden.indexOf(s.id) < 0);
let numbering = "ok";
kept.forEach(function (s, i) {
  const to = i + 1;
  if (s.stage === to) return;
  const re = new RegExp('setStageNo\\("' + s.id + '",\\s*SIMPLE\\?"' + to + '":"' + s.stage + '"\\)');
  if (!re.test(js)) numbering = s.id + " shows " + s.stage + ", should renumber to " + to;
});
t("simple-mode stage numbers run 1..n with no gaps", numbering, "ok");

// the fragment is the durable path, so it must not collide with an element id
t("adding throws is gated on a declared mode",
  /\$\("more"\)\.onclick=function\(\)\{\s*if\(S\.mode!=="real"\)return;/.test(js), true);
t("grid keystrokes are gated on a declared mode",
  /\$\("throws"\)\.addEventListener\("keydown",function\(e\)\{\s*if\(S\.mode!=="real"\)return;/.test(js), true);
t("the gate keeps a state line and a note", ids.has("gateState") && ids.has("gateNote"), true);
t("the gate is no longer hidden on selection", /\$\("gate"\)\.hidden=true/.test(js), false);
t("the gate marks the chosen path",
  /classList\.toggle\("chosen",kind==="real"\)/.test(js) &&
  /classList\.toggle\("chosen",kind==="test"\)/.test(js), true);
// nothing locks. A declaration that invalidates the rolls clears them, behind a prompt
for (const id of ["dice", "dieType", "startReal", "startTest"])
  t(id + " is never disabled", new RegExp('\\$\\("' + id + '"\\)\\.disabled=').test(js), false);
// no native modal anywhere: a sandboxed frame or an embedded viewer suppresses them
// and confirm() returns false without showing anything, which reads as a dead control
t("the script never calls confirm, alert or prompt",
  /(^|[^.\w])(confirm|alert|prompt)\s*\(/.test(js.replace(/\/\/[^\n]*/g, "")), false);
t("the confirmation lives in the markup",
  ids.has("confirmBox") && ids.has("confirmMsg") && ids.has("confirmYes") && ids.has("confirmNo"), true);
t("a destructive change is routed through the in-page question",
  /askThenApply\(id==="dieType"\?"the die":"the dice per throw"/.test(js), true);
t("the question applies nothing until the button is clicked",
  /\$\("confirmYes"\)\.onclick=function\(\)\{const f=PENDING;dismissAsk\(\);if\(f\)f\(\)\}/.test(js), true);
t("declining discards the pending change",
  /\$\("confirmNo"\)\.onclick=function\(\)\{dismissAsk\(\);/.test(js), true);
t("the selector reverts before the question is asked",
  /this\.value=\(id==="dieType"\?PREV\.die:String\(PREV\.dice\)\);/.test(js), true);
t("the die and the dice per throw are the destructive pair",
  /if\(!\(\(id==="dieType"\)\|\|\(id==="dice"&&S\.mode==="real"\)\)\)/.test(js), true);
t("a mode switch is gated the same way", /askThenApply\("to "\+/.test(js), true);
t("a question with no rolls behind it applies at once",
  /if\(n===0\)\{apply\(\);return\}/.test(js), true);
t("a question withdraws itself when the rolls go away",
  /if\(PENDING&&!has\)dismissAsk\(\);/.test(js), true);
t("clearing empties the grid and the blob",
  /function clearRolls\(\)\{[\s\S]{0,160}\$\("blob"\)\.value="";/.test(js), true);

t("simple mode neither forces nor refuses a die",
  /simpleChk"\)\.checked=false/.test(js) || /dieType"\)\.value="d6"/.test(js), false);
t("the die selector is not marked full-mode only",
  /<div class="fullonly"><label class="f" for="dieType">/.test(markup), false);
t("the imbalance selector is still full-mode only",
  /<div class="fullonly"><label class="f" for="pmax">/.test(markup), true);
t("the roll-count explanation is computed from the die",
  /a perfectly fair "\+S\.die\+/.test(js), true);

// the typed row and the pip row must advance by the same cell
t("a shared cell variable is set from the die and the gap",
  /rs\.setProperty\("--cell",\(die\+gap\)\+"px"\);/.test(js), true);
t("the input advances by one cell per character",
  css ? /letter-spacing:calc\(var\(--cell,16px\) - 1ch\)/.test(css[1]) : false, true);
t("the input centres each glyph over its die",
  css ? /text-indent:calc\(var\(--die,14px\) \/ 2 - \.5ch\)/.test(css[1]) : false, true);
t("the input no longer carries a fixed letter-spacing",
  css ? /\.throw input\{[^}]*letter-spacing:\.3em/.test(css[1]) : false, false);
t("a numeral face occupies exactly one die width",
  css ? /\.dnum\{\s*width:var\(--die,14px\);height:var\(--die,14px\)/.test(css[1]) : false, true);
// The alignment is exact for any monospace advance, not tuned to one font. Glyph i
// sits at indent + i*(ch + letterSpacing) and is ch wide, so its centre is
//   (die/2 - ch/2) + i*(ch + cell - ch) + ch/2  =  i*cell + die/2
// which is where die i's centre is. The ch terms cancel, so the result is
// independent of the font's advance width.
{
  const die = 14, gap = 2, cell = die + gap;
  let aligned = true, worst = 0;
  for (const ch of [6, 7.5, 8.4, 9.12, 10, 11.2, 13]) {
    const ls = cell - ch, indent = die / 2 - ch / 2;
    for (let i = 0; i < 10; i++) {
      const glyphCentre = indent + i * (ch + ls) + ch / 2;
      const dieCentre = i * cell + die / 2;
      worst = Math.max(worst, Math.abs(glyphCentre - dieCentre));
      if (Math.abs(glyphCentre - dieCentre) > 1e-9) aligned = false;
    }
  }
  t("typed digits centre over their dice for any monospace advance", aligned, true);
  t("worst-case alignment error is zero", worst.toFixed(9), (0).toFixed(9));
  // and the row cannot outgrow the box the layout reserves
  for (const n of [1, 2, 5, 10]) {
    const typed = n * cell + (die / 2 - 6 / 2);
    const pips = n * die + (n - 1) * gap;
    const box = Math.max(44, n * cell + 22) - 12 - 2;
    t("both rows fit the box at " + n + " dice", typed <= box && pips <= box, true);
  }
}
t("the throw box leaves room for the cell row",
  /Math\.max\(44,S\.dice\*\(die\+gap\)\+22\)/.test(js), true);
t("a chosen button has a rule", css ? /button\.chosen:disabled\{/.test(css[1]) : false, true);
t("no element takes the id simple", ids.has("simple"), false);
t("ticking the switch writes the fragment", /location\.hash="simple"/.test(js), true);
t("the fragment points at the lesser mode",
  /hashWantsSimple=\(\)=>location\.hash\.replace\(\/\^#\/,""\)\.toLowerCase\(\)==="simple"/.test(js), true);
if (css) t("both mode classes have a rule",
  /body\.simple \.fullonly\{display:none\}/.test(css[1]) &&
  /body:not\(\.simple\) \.simpleonly\{display:none\}/.test(css[1]), true);

console.log("");
console.log(pass + " passed, " + fail + " failed   (" + file + ")");
process.exit(fail ? 1 : 0);
