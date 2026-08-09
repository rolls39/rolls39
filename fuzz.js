#!/usr/bin/env node
// rolls39 fuzz and differential audit.
//
//   node fuzz.js                        rolls39.html, 2000 cases, random seed
//   node fuzz.js rolls39.html 5000 42   explicit file, case count and seed
//
// Every failure prints the seed and, for the interface walk, the exact action list
// that produced it. Re-running with that seed reproduces the failure exactly, so a
// report can be handed over as one line.
//
// Three parts, each looking for a different kind of mistake:
//
//   A  differential   our core against bitcoinjs/bip39, an unrelated implementation.
//                     Catches a wrong answer that is wrong consistently, which no
//                     self-check inside one file can find.
//   B  properties     random inputs against rules that must hold for every input,
//                     rather than against a fixed list of expected answers.
//   C  interface walk random clicking and typing, checking after every single action
//                     that what is on screen still agrees with itself. This is the
//                     part that finds stale output, lost state and crashes.
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const bip39 = require("bip39");
const { JSDOM } = require("jsdom");

const file = process.argv[2] || "rolls39.html";
const N = +(process.argv[3] || 2000);
const SEED = process.argv[4] === undefined ? (Math.random() * 1e9) | 0 : +process.argv[4];
const html = fs.readFileSync(file, "utf8");

// seeded PRNG, so a failing run is reproducible from the printed seed
let state = (SEED >>> 0) || 1;
const rnd = () => {
  state ^= state << 13; state >>>= 0;
  state ^= state >> 17;
  state ^= state << 5; state >>>= 0;
  return state / 4294967296;
};
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

let fails = 0, checks = 0;
const bad = (part, what, detail) => {
  fails++;
  if (fails <= 25) console.log("FAIL [" + part + "] " + what + "\n      " + detail);
};
const ok = (part, cond, what, detail) => { checks++; if (!cond) bad(part, what, detail); };

// ---- lift the core ----
const core = html.split("//<core>")[1].split("//</core>")[0];
const C = {};
new Function("exports", core +
  "\nObject.assign(exports,{sha256,ascii,hex,bitsOf,bytesFromHex,mnemonic,fromRolls,WORDS," +
  "DICE,faces,dieBits,rollBits,filterRolls,rollCount});")(C);

const WORDCOUNTS = [12, 15, 18, 21, 24];
const DIEKEYS = Object.keys(C.DICE);

// =====================================================================
// A. differential against bitcoinjs/bip39
// =====================================================================
{
  const part = "diff";
  for (let i = 0; i < N; i++) {
    const words = pick(WORDCOUNTS);
    const entBytes = words * 32 / 3 / 8;
    const ent = Buffer.alloc(entBytes);
    for (let k = 0; k < entBytes; k++) ent[k] = int(0, 255);
    const mine = C.mnemonic(new Uint8Array(ent)).phrase;
    const theirs = bip39.entropyToMnemonic(ent.toString("hex"));
    ok(part, mine === theirs, "mnemonic disagrees at " + words + " words",
      "entropy " + ent.toString("hex") + "\n      ours   " + mine + "\n      theirs " + theirs);
    ok(part, bip39.validateMnemonic(mine), "our mnemonic fails their checksum check",
      "entropy " + ent.toString("hex"));
    ok(part, bip39.mnemonicToEntropy(mine) === ent.toString("hex"),
      "their round trip does not return our entropy", "entropy " + ent.toString("hex"));
  }
  // and the whole roll-string path, digest included, against node's own sha256
  for (let i = 0; i < N; i++) {
    const die = pick(DIEKEYS), words = pick(WORDCOUNTS);
    const f = C.faces(die);
    let rolls = "";
    for (let k = int(0, 200); k > 0; k--) rolls += pick(f);
    const r = C.fromRolls(rolls, words, die);
    const nodeDigest = crypto.createHash("sha256").update(rolls, "latin1").digest("hex");
    ok(part, C.hex(r.digest) === nodeDigest, "digest disagrees with node crypto",
      die + " " + rolls.slice(0, 40) + "…");
    const entHex = C.hex(r.entropy);
    ok(part, r.m.phrase === bip39.entropyToMnemonic(entHex),
      "phrase disagrees with bip39 for a rolled string", die + " " + words + "w " + entHex);
  }
}

// =====================================================================
// B. properties that must hold for every input
// =====================================================================
{
  const part = "prop";
  const JUNK = ["", " ", "\n", "\t", "0", "7", "8", "9", "x", "X", "-", ".", ",", "/", "\\",
    "é", "字", "\u0000", "\uFFFD", "🎲", "<script>", "'", '"', "&amp;", "\r\n", "%", "+"];
  for (let i = 0; i < N; i++) {
    const die = pick(DIEKEYS), words = pick(WORDCOUNTS);
    const f = C.faces(die), top = C.DICE[die].n;
    // junk means junk for this die: 7 and 8 are faces of a d8, so they are not junk there
    const junk = JUNK.filter(j => ![...j].some(ch => f.indexOf(ch) >= 0));
    // a string of legal faces with junk sprinkled through it
    let raw = "", legal = "";
    const len = int(0, 260);
    for (let k = 0; k < len; k++) {
      if (rnd() < 0.25) { raw += pick(junk); }
      else { const d = pick(f); raw += d; legal += d; }
    }
    const filt = C.filterRolls(raw, die);
    ok(part, filt === legal, "filter did not recover exactly the legal faces",
      die + " raw " + JSON.stringify(raw.slice(0, 60)));
    ok(part, [...filt].every(ch => ch >= "1" && ch <= String(top)),
      "filter left a character outside 1.." + top, die + " -> " + filt.slice(0, 60));
    ok(part, filt.indexOf("0") < 0, "a zero survived the filter", die + " -> " + filt.slice(0, 60));
    ok(part, C.rollCount(raw, die) === filt.length, "roll count is not the filtered length", die);

    const r = C.fromRolls(raw, words, die);
    ok(part, r.filtered === filt, "fromRolls filtered differs from filterRolls", die);
    // the die changes accounting only, never the mapping
    for (const other of DIEKEYS) {
      if (C.faces(other).length < top) continue;
      ok(part, C.hex(C.fromRolls(filt, words, other).digest) === C.hex(r.digest),
        "digest changed with the die for an identical string", die + " vs " + other);
    }
    ok(part, r.entropy.length === words * 32 / 3 / 8, "entropy length wrong for " + words + "w", die);
    ok(part, C.hex(r.digest).length === 64, "digest is not 32 bytes", die);
    ok(part, r.m.rows.length === words, "row count is not the word count", words + "w");

    // every row: eleven bits, place values summing to the index, index naming the word
    const PV = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
    let rowsOk = true, wordsOk = true;
    for (const row of r.m.rows) {
      if (row.bits.length !== 11) rowsOk = false;
      let sum = 0;
      for (let k = 0; k < 11; k++) if (row.bits.charAt(k) === "1") sum += PV[k];
      if (sum !== row.idx || C.WORDS[sum] !== row.word) rowsOk = false;
      if (C.WORDS.indexOf(row.word) < 0) wordsOk = false;
    }
    ok(part, rowsOk, "a row's bits, index and word disagree", die + " " + words + "w");
    ok(part, wordsOk, "a phrase word is not in the wordlist", die + " " + words + "w");

    // checksum is the leading CS bits of sha256 over the entropy bytes
    const last = r.m.rows[r.m.rows.length - 1], cs = words / 3;
    ok(part, last.bits.slice(last.csFrom) === C.bitsOf(C.sha256(r.entropy)).slice(0, cs),
      "checksum bits are not the leading digest bits", words + "w");
    ok(part, last.bits.length - last.csFrom === cs, "checksum width wrong", words + "w");
    ok(part, bip39.validateMnemonic(r.m.phrase), "the phrase fails an independent checksum check",
      die + " " + words + "w");

    // shorter phrases are prefixes of longer ones from the same digest
    const w12 = C.fromRolls(raw, 12, die).m.phrase.split(" ").slice(0, 11).join(" ");
    const w24 = C.fromRolls(raw, 24, die).m.phrase.split(" ").slice(0, 11).join(" ");
    ok(part, w12 === w24, "12 and 24 word phrases differ in their first 11 words", die);

    // determinism, and independence from anything but the filtered string
    ok(part, C.hex(C.fromRolls(raw, words, die).digest) === C.hex(r.digest),
      "fromRolls is not deterministic", die);
    ok(part, C.rollBits(die, 0).toFixed(9) === Math.log2(top).toFixed(9),
      "fair bits per roll is not log2(faces)", die);
    const e = pick([0, 0.05, 0.1, 0.2, 0.5, 1, 3]);
    ok(part, Math.abs((C.dieBits(die) - C.rollBits(die, e)) - Math.log2(1 + e)) < 1e-12,
      "imbalance cost is not log2(1+e)", die + " e=" + e);
  }
  // SHA-256 across every padding boundary, against node
  for (let i = 0; i < 600; i++) {
    const n = int(0, 400);
    let sIn = "";
    for (let k = 0; k < n; k++) sIn += String.fromCharCode(int(1, 126));
    ok("prop", C.hex(C.sha256(C.ascii(sIn))) ===
      crypto.createHash("sha256").update(sIn, "latin1").digest("hex"),
      "sha256 disagrees with node at " + n + " bytes", JSON.stringify(sIn.slice(0, 30)));
  }
}

// =====================================================================
// C. interface walk: random actions, invariants after every one
// =====================================================================
{
  const part = "walk";
  const WALKS = Math.max(6, Math.round(N / 60));
  const STEPS = 90;

  for (let walk = 0; walk < WALKS && fails < 25; walk++) {
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://x/rolls39.html" });
    const w = dom.window;
    w.Element.prototype.scrollIntoView = function () {};
    let native = 0;
    w.confirm = () => { native++; return false; };
    w.alert = () => { native++; };
    const doc = w.document, $ = id => doc.getElementById(id);
    const log = [];
    let crashed = null;
    w.addEventListener("error", e => { crashed = String(e.error || e.message); });

    const shown = el => {
      if (!el) return false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.hasAttribute("hidden")) return false;
        if (w.getComputedStyle(n).display === "none") return false;
      }
      return true;
    };
    const live = id => { const el = $(id); return el && !el.disabled && shown(el); };
    const key = k => {
      const inp = doc.querySelector(".throw.active input");
      if (inp) inp.dispatchEvent(new w.KeyboardEvent("keydown",
        { key: k, bubbles: true, cancelable: true }));
    };
    const fire = (id, ev) => $(id).dispatchEvent(new w.Event(ev, { bubbles: true }));

    const ACTIONS = [
      () => { if (!live("startReal")) return; log.push("startReal"); $("startReal").click(); },
      () => { if (!live("startTest")) return; log.push("startTest"); $("startTest").click(); },
      () => { const k = pick(["1","2","3","4","5","6","7","8","9","0","x","Enter","Backspace"]);
              log.push("key " + k); key(k); },
      () => { if (!live("dieType")) return; const f = C.faces($("dieType").value);
              const n = int(1, 12); let s2 = "";
              for (let k = 0; k < n; k++) s2 += pick(f);
              log.push("type " + s2); for (const ch of s2) key(ch); },
      () => { const v = pick(DIEKEYS); log.push("dieType " + v); $("dieType").value = v; fire("dieType", "change"); },
      () => { if (!live("dice")) return; const v = String(int(1, 10)); log.push("dice " + v); $("dice").value = v; fire("dice", "change"); },
      () => { if (!live("words")) return; const v = String(pick(WORDCOUNTS)); log.push("words " + v); $("words").value = v; fire("words", "change"); },
      () => { if (!live("pmax")) return; const v = pick(["0","0.05","0.10","0.20","0.50"]); log.push("pmax " + v); $("pmax").value = v; fire("pmax", "change"); },
      () => { log.push("confirmYes"); if (shown($("confirmBox"))) $("confirmYes").click(); },
      () => { log.push("confirmNo"); if (shown($("confirmBox"))) $("confirmNo").click(); },
      () => { const on = !$("simpleChk").checked; log.push("simple " + on);
              $("simpleChk").checked = on; fire("simpleChk", "change"); },
      () => { if (!live("skipVerify")) return; log.push("skipVerify"); $("skipVerify").checked = !$("skipVerify").checked; fire("skipVerify", "change"); },
      () => { if (!$("attest").disabled) { log.push("attest");
              $("attest").checked = !$("attest").checked; fire("attest", "change"); } },
      () => { if (!live("more")) return; log.push("more"); $("more").click(); },
      () => { const junk = ["", "123456", "6116322261665154111", "0000", "77777",
                "1 2 3 4 5 6", "abc123456", "1".repeat(300), "🎲12345", "12\n34\t56"];
              const v = pick(junk); log.push("blob " + JSON.stringify(v.slice(0, 24)));
              $("blob").value = v; fire("blob", "input"); },
      () => { const v = pick(["", "deadbeef", C.hex(C.sha256(C.ascii("x"))),
                "SHA2-256(stdin)= " + "a".repeat(64), "not hex at all", "  "]);
              log.push("check " + JSON.stringify(v.slice(0, 20)));
              $("check").value = v; fire("check", "input"); },
      () => { if (!live("copyPhrase")) return; log.push("copyPhrase"); $("copyPhrase").click(); },
      () => { if (!live("copyFiltered")) return; log.push("copyFiltered"); $("copyFiltered").click(); },
      () => { if (!live("calcClear")) return; log.push("calcClear"); $("calcClear").click(); }
    ];

    for (let step = 0; step < STEPS && fails < 25; step++) {
      try { pick(ACTIONS)(); }
      catch (e) { bad(part, "an action threw", "seed " + SEED + "\n      actions: " +
        log.join(" | ") + "\n      " + e.stack.split("\n").slice(0, 3).join(" ")); break; }
      if (crashed) { bad(part, "an event handler threw",
        "seed " + SEED + "\n      actions: " + log.join(" | ") + "\n      " + crashed); break; }

      const ctx = () => "seed " + SEED + " walk " + walk + " step " + step +
        "\n      actions: " + log.slice(-14).join(" | ");
      const die = $("dieType").value, dice = +$("dice").value, words = +$("words").value;
      const filtered = $("filtered").textContent;
      const boxes = [...doc.querySelectorAll("#throws .throw input")].map(i => i.value);
      const mode = $("startReal").className.indexOf("chosen") >= 0 ? "real"
                 : $("startTest").className.indexOf("chosen") >= 0 ? "test" : null;

      // nothing may be recorded before a mode is declared
      if (mode === null)
        ok(part, filtered === "" && boxes.every(v => v === ""),
          "digits exist with no mode declared", ctx());

      // never a native modal, whatever the container allows
      ok(part, native === 0, "a native dialog was used", ctx());

      // the roll string is exactly the boxes, or exactly the filtered blob
      if (mode === "real")
        ok(part, filtered === boxes.join(""), "roll string is not the boxes joined",
          ctx() + "\n      boxes " + JSON.stringify(boxes.join("")) + " shown " + JSON.stringify(filtered));
      if (mode === "test")
        ok(part, filtered === C.filterRolls($("blob").value, die),
          "roll string is not the filtered blob", ctx());

      // no box may hold an illegal face or overflow the dice per throw
      const legal = C.faces(die);
      ok(part, boxes.every(v => v.length <= dice), "a box holds more than " + dice + " digits",
        ctx() + "\n      mode=" + mode + " dice=" + dice + " die=" + die +
        " realArea=" + shown($("realArea")) + " maxlength=" +
        (doc.querySelector(".throw input") ? doc.querySelector(".throw input").getAttribute("maxlength") : "-") +
        "\n      boxes=" + JSON.stringify(boxes.filter(v => v !== "")));
      ok(part, boxes.every(v => [...v].every(ch => legal.indexOf(ch) >= 0)),
        "a box holds a character that is not a face of the " + die, ctx());
      ok(part, doc.querySelectorAll(".throw.active").length <= 1,
        "more than one active box", ctx());
      // nothing may be entered past the active box
      const act = doc.querySelector(".throw.active");
      if (act) {
        const ai = +act.dataset.i;
        ok(part, boxes.slice(ai + 1).every(v => v === ""), "a box after the active one has digits", ctx());
      }

      // everything downstream must agree with the string on screen, or be blank
      if (filtered.length === 0) {
        for (const id of ["hexPlain", "phrase", "hexOut", "binOut", "tbody"])
          ok(part, $(id).innerHTML === "", "#" + id + " is stale with no rolls entered", ctx());
        ok(part, $("phraseSec").className.indexOf("locked") >= 0,
          "the phrase section is open with no rolls", ctx());
      } else {
        const r = C.fromRolls(filtered, words, die);
        ok(part, $("hexPlain").textContent === C.hex(r.digest),
          "the shown digest is not sha256 of the shown string", ctx());
        const shownWords = [...$("phrase").querySelectorAll("span")]
          .map(x => x.textContent.replace(/^\d+/, "")).join(" ");
        ok(part, shownWords === r.m.phrase, "the shown phrase does not match the shown string", ctx());
        ok(part, bip39.validateMnemonic(shownWords) || shownWords === "",
          "the shown phrase has a bad checksum", ctx() + "\n      " + shownWords);
      }

      // simple mode: the words appear only once the target is met
      if ($("simpleChk").checked && shown($("phrase"))) {
        const bits = filtered.length * C.rollBits(die, +$("pmax").value);
        ok(part, bits >= words * 32 / 3 - 1e-9,
          "simple mode showed a phrase below the entropy target",
          ctx() + "\n      " + bits.toFixed(1) + " of " + (words * 32 / 3));
      }
      // and never any verification surface
      if ($("simpleChk").checked)
        for (const id of ["tbody", "hexOut", "calc", "printSheet", "attest", "check"])
          ok(part, !shown($(id)), "simple mode is showing #" + id, ctx());

      // the die selector and the roll string can never disagree
      ok(part, [...filtered].every(ch => legal.indexOf(ch) >= 0),
        "the roll string holds a character the current die cannot produce", ctx());
    }
  }
}

console.log("");
console.log(checks + " checks, " + fails + " failed   (" + file + ", " + N + " cases, seed " + SEED + ")");
if (fails) console.log("reproduce with:  node fuzz.js " + file + " " + N + " " + SEED);
process.exit(fails ? 1 : 0);
