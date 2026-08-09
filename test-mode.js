#!/usr/bin/env node
// Runtime check of the simple-mode switch. Usage: node test-mode.js rolls39.html
//
// Loads the page in jsdom, drives the switch and the throw grid, and asserts that
// the mode changes what is on screen and leaves the roll string, the digest and
// the phrase identical. Companion to test-core.js, which covers the //<core> block.
"use strict";
const fs = require("fs");
const { JSDOM } = require("jsdom");

const file = process.argv[2] || "rolls39.html";
const html = fs.readFileSync(file, "utf8");

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (String(got) === String(want)) { pass++; return; }
  fail++;
  console.log("FAIL  " + name + "\n        got " + got + "\n        want " + want);
};

// 99 rolls is the cross-tool regression fixture. 111 is what the page asks for at
// its default bias of 0.20, so the phrase gate only opens at the longer string.
const R99 = "611632226166515411122551526665424531264332231141335316451415365352611623121434632332636661562562244";
const R111 = R99 + R99.slice(0, 12);
const DIGEST99 = "8616c066396ee300fad86cf5ad083ec46c09d273e389642f35468e92c96730d6";
const DIGEST111 = "f411e2083cb53f9837ea6e418a293eb6c4cb01f98d181d98dbb4d67a0a61f51a";
const PHRASE111 = "village monitor link just fault slot text evidence dose eyebrow exile horn erosion liberty tower perfect budget short unfold provide pass couch stamp expect";

// the two lists from section 2 of the handoff, "simple mode: the whole surface"
const DROP = ["os","cmd","cmdNote","copyCmd","check","checkOut","vstate","skipVerify",
  "hexOut","binOut","nibs","tbody","truncNote","calc","calcOut","calcClear","csDetails",
  "printSheet","withList","attest","copyFiltered","pmax"];
// #gate hides once a mode is declared, so it is checked separately before the start
// #gate and its two buttons hide once a mode is declared, so they are checked
// before the start rather than during the roll
const KEEP_AT_START = ["gate","startReal","startTest"];
const KEEP_WHILE_ROLLING = ["dice","words","dieType","throws","more","reset","stats","meter",
  "need","filtered","fstats","phrase","copyPhrase","selftest"];

function page(hash) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://x/rolls39.html" + (hash || "") });
  const w = dom.window;
  // jsdom has no layout, so the page's smooth-scroll calls would throw and mask
  // real failures. Stubbed here rather than in the page.
  w.Element.prototype.scrollIntoView = function () {};
  // A sandboxed frame suppresses modals: confirm returns false without showing
  // anything. Model that, and count any use so the suite can require none.
  const st = { native: 0, answer: true };
  w.confirm = () => { st.native++; return false; };
  w.alert = () => { st.native++; };
  w.prompt = () => { st.native++; return null; };
  return {
    nativeDialogs() { return st.native; },
    answerYes() { st.answer = true; },
    answerNo() { st.answer = false; },
    asking() { const el = w.document.getElementById("confirmBox"); return el && !el.hidden; },
    lastPrompt() { return w.document.getElementById("confirmMsg").textContent; },
    change(id, v) {
      this.$(id).value = v;
      this.$(id).dispatchEvent(new w.Event("change", { bubbles: true }));
      return this.asking();
    },
    clickMode(kind) {
      this.$(kind === "real" ? "startReal" : "startTest").click();
      return this.asking();
    },
    settle() {
      if (!this.asking()) return false;
      w.document.getElementById(st.answer ? "confirmYes" : "confirmNo").click();
      return true;
    },
    w,
    $: id => w.document.getElementById(id),
    shown(el) {
      if (!el) return "missing";
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.hasAttribute("hidden")) return false;
        if (w.getComputedStyle(n).display === "none") return false;
      }
      return true;
    },
    seen(id) { return this.shown(this.$(id)); },
    tick(id, on) {
      this.$(id).checked = on;
      this.$(id).dispatchEvent(new w.Event("change", { bubbles: true }));
    },
    type(s) {
      for (const ch of s) {
        const inp = w.document.querySelector(".throw.active input");
        if (!inp) return;
        inp.dispatchEvent(new w.KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true }));
      }
    },
    box() { const el = w.document.querySelector(".throw.active input"); return el ? el.value : "(none)"; },
    stage(secId) {
      return this.$(secId).querySelector(".eyebrow").textContent.trim().charAt(0);
    },
    words() {
      return [...this.$("phrase").querySelectorAll("span")]
        .map(s => s.textContent.replace(/^\d+/, "")).join(" ");
    }
  };
}

// ---- full mode is the default, and the fragment only ever selects the lesser mode ----
{
  const p = page();
  t("default mode is full", p.$("simpleChk").checked, false);
  t("full mode shows step 3", p.seen("verifySec"), true);
  t("full mode shows step 4", p.seen("tableSec"), true);
  t("full mode shows the imbalance selector", p.seen("pmax"), true);
  t("full mode shows the die selector", p.seen("dieType"), true);
  t("the die defaults to d6", p.$("dieType").value, "d6");
  t("the imbalance defaults to +20%", p.$("pmax").value, "0.20");
  t("no convention notice on a d6", p.seen("convNote"), false);
  t("dice per throw offers ten", p.$("dice").options.length, 10);
  t("dice per throw defaults to five", p.$("dice").value, "5");
  t("full mode numbers the phrase stage 5", p.stage("phraseSec"), "5");
  t("the mode line is visible before any choice", p.seen("modeNote"), true);
  t("the gate is visible before a mode is declared", p.seen("gate"), true);
}
{
  const p = page("#simple");
  t("simple mode: the gate and both start buttons are on screen",
    KEEP_AT_START.filter(id => p.seen(id) !== true).join(",") || "none", "none");
}
t("#simple on load ticks the switch", page("#simple").$("simpleChk").checked, true);
t("#simple is case-insensitive", page("#SIMPLE").$("simpleChk").checked, true);
t("#verify lands on the full page", page("#verify").$("simpleChk").checked, false);
t("a stripped fragment lands on the full page", page("").$("simpleChk").checked, false);
{
  const p = page("#simple");
  t("#simple on load hides step 3", p.seen("verifySec"), false);
  t("#simple on load hides step 4", p.seen("tableSec"), false);
  t("#simple on load keeps the mode line", p.seen("modeNote"), true);
}

// ---- real dice, 111 rolls, full page, then switch mid-session ----
{
  const p = page();
  p.$("startReal").click(); p.settle();
  t("full mode: default bias asks for 111 rolls at 24 words", /\b111 rolls\b/.test(p.$("need").textContent), true);
  t("full mode: grid sized for 111 rolls of 5", p.w.document.querySelectorAll(".throw").length, 23);
  p.type(R111);
  t("full mode: rolls string", p.$("filtered").textContent, R111);
  t("full mode: digest", p.$("hexPlain").textContent, DIGEST111);
  t("full mode: dice validation rejects a 7", (() => {
    const before = p.$("filtered").textContent;
    p.type("7");
    return p.$("filtered").textContent === before;
  })(), true);
  t("full mode: step 4 locked until verified or skipped", p.seen("tbody"), false);
  p.tick("skipVerify", true);
  t("full mode: step 4 opens on skip", p.seen("tbody"), true);
  t("full mode: phrase gated on the attestation", p.$("phraseSec").className.indexOf("locked") >= 0, true);
  p.tick("attest", true);
  t("full mode: phrase after attesting", p.words(), PHRASE111);
  t("full mode: drop list all on screen", DROP.filter(id => p.seen(id) !== true).join(",") || "none", "none");

  // the switch
  p.tick("simpleChk", true);
  t("simple mode: rolls survive the switch", p.$("filtered").textContent, R111);
  t("simple mode: digest unchanged", p.$("hexPlain").textContent, DIGEST111);
  t("simple mode: phrase unchanged", p.words(), PHRASE111);
  t("simple mode: throw grid survives", p.w.document.querySelectorAll(".throw").length, 23);
  t("simple mode: fragment written", p.w.location.hash, "#simple");
  t("simple mode: digest relocated into step 2", p.$("hexPlain").parentElement.id, "hexSlot");
  t("simple mode: digest still on screen", p.seen("hexPlain"), true);
  t("simple mode: phrase stage renumbered to 3", p.stage("phraseSec"), "3");
  t("simple mode: drop list all off screen", DROP.filter(id => p.seen(id) !== false).join(",") || "none", "none");
  t("simple mode: keep list all on screen",
    KEEP_WHILE_ROLLING.filter(id => p.seen(id) !== true).join(",") || "none", "none");
  t("simple mode: imbalance selector off screen", p.seen("pmax"), false);
  t("simple mode: die selector stays on screen", p.seen("dieType"), true);
  t("simple mode: copy-rolls button off screen", p.seen("copyFiltered"), false);
  t("simple mode: rolls string is still selectable",
    p.w.getComputedStyle(p.$("filtered")).getPropertyValue("user-select") ||
    p.w.getComputedStyle(p.$("filtered")).getPropertyValue("-webkit-user-select"), "all");
  t("simple mode: no-sort instruction survives", /never sort/i.test(p.$("realArea").textContent), true);
  t("simple mode: locked throws survive",
    p.w.document.querySelectorAll(".throw input[readonly]").length > 0, true);

  // and back, losing nothing
  p.tick("simpleChk", false);
  t("full mode again: rolls survive", p.$("filtered").textContent, R111);
  t("full mode again: phrase survives", p.words(), PHRASE111);
  t("full mode again: digest back in step 3", p.$("hexPlain").parentElement.id, "hexHome");
  t("full mode again: stage 5 restored", p.stage("phraseSec"), "5");
  t("full mode again: drop list back on screen",
    DROP.filter(id => p.seen(id) !== true).join(",") || "none", "none");
}

// ---- the target gate is the only thing between a short roll and a phrase ----
{
  const p = page("#simple");
  p.$("startTest").click(); p.settle();
  const set = s => {
    p.$("blob").value = s;
    p.$("blob").dispatchEvent(new p.w.Event("input", { bubbles: true }));
  };
  t("simple mode: no rolls, stub names the target",
    /^Appears at 256 bits of min-entropy\.$/.test(p.$("phraseStub").textContent), true);
  set(R99);
  t("simple mode: the 99-roll fixture still hashes correctly", p.$("hexPlain").textContent, DIGEST99);
  t("simple mode: 99 rolls is short of the 111-roll target",
    p.$("phraseSec").className.indexOf("locked") >= 0, true);
  t("simple mode: short rolls hide the words", p.seen("phrase"), false);
  t("simple mode: stub shows progress",
    /^229\.\d of 256 bits of min-entropy\. Keep rolling\.$/.test(p.$("phraseStub").textContent), true);
  t("simple mode: short notice names no words on screen",
    /guessable/.test(p.$("shortWarn").innerHTML), false);
  t("simple mode: short notice gives the roll target",
    /Keep rolling to 111 rolls/.test(p.$("shortWarn").innerHTML), true);
  set(R111);
  t("simple mode: phrase appears once the target is met",
    p.$("phraseSec").className.indexOf("locked") >= 0, false);
  t("simple mode: phrase is the expected one", p.words(), PHRASE111);
  set("");
  t("simple mode: clearing the rolls re-locks the phrase",
    p.$("phraseSec").className.indexOf("locked") >= 0, true);
}

// ---- full mode keeps showing the words live, which is the lesson ----
{
  const p = page();
  p.$("startTest").click(); p.settle();
  p.$("blob").value = "6";
  p.$("blob").dispatchEvent(new p.w.Event("input", { bubbles: true }));
  p.tick("skipVerify", true);
  t("full mode: one roll still fills the bits table", p.$("tbody").querySelectorAll("tr").length, 24);
  t("full mode: one roll raises the guessable warning", /guessable/.test(p.$("shortWarn").innerHTML), true);
  t("full mode: attestation is disabled while short", p.$("attest").disabled, true);
}

// ---- die types ----
{
  const p = page();
  const need = () => p.$("need").textContent;
  const pick = (id, v) => {
    p.$(id).value = v;
    p.$(id).dispatchEvent(new p.w.Event("change", { bubbles: true }));
  };
  t("the die menu offers three types", p.$("dieType").options.length, 3);
  t("the die menu stops at d8",
    [...p.$("dieType").options].map(o => o.value).join(","), "d4,d6,d8");
  pick("pmax", "0");
  t("d6 fair asks for 100 rolls", /\b100 rolls\b/.test(need()), true);
  pick("pmax", "0.20");
  t("d6 at +20% asks for 111 rolls", /\b111 rolls\b/.test(need()), true);
  pick("dieType", "d8");
  t("d8 at +20% asks for 94 rolls", /\b94 rolls\b/.test(need()), true);
  t("d8 says it has no shared convention", p.seen("convNote"), true);
  t("the convention notice names the die", /^d8 has no shared convention\./.test(p.$("convNote").textContent), true);
  pick("dieType", "d4");
  t("d4 at +20% asks for 148 rolls", /\b148 rolls\b/.test(need()), true);
  pick("dieType", "d8");
  p.$("startReal").click(); p.settle();
  t("d8 does not disable the die selector", p.$("dieType").disabled, false);
  t("d8 box holds one character per die",
    p.w.document.querySelector(".throw input").getAttribute("maxlength"), "5");
  p.type("1278");
  t("d8 takes 7 and 8", p.$("filtered").textContent, "1278");
  t("d8 box shows what was typed", p.box(), "1278");
  p.type("9");
  t("d8 rejects a 9 at the box", p.box(), "1278");
  t("d8 rejects a 9 in the roll string", p.$("filtered").textContent, "1278");
  p.type("0");
  t("d8 rejects a 0 at the box", p.box(), "1278");
  t("d8 rejects a 0 in the roll string", p.$("filtered").textContent, "1278");
  t("d8 renders numerals rather than pips",
    p.w.document.querySelectorAll("#throws .dnum").length, 4);
  t("d8 renders no pip dice", p.w.document.querySelectorAll("#throws .die").length, 0);
  t("d8 counts one roll per character", /rolls <b>4<\/b>/.test(p.$("fstats").innerHTML), true);
}
{
  const p = page();
  p.$("startReal").click(); p.settle();
  p.type("123456");
  t("d6 still renders pip dice", p.w.document.querySelectorAll("#throws .die").length, 6);
  t("d6 renders no numerals", p.w.document.querySelectorAll("#throws .dnum").length, 0);
  // the box and the roll string must agree, or the grid is accepting keys the core
  // then discards and the screen stops matching what gets hashed
  for (const bad of ["7", "8", "9", "0", "a", "-"]) {
    const box = p.box(), str = p.$("filtered").textContent;
    p.type(bad);
    t("d6 rejects " + bad + " at the box", p.box(), box);
    t("d6 rejects " + bad + " in the roll string", p.$("filtered").textContent, str);
  }
  t("the box and the roll string agree",
    p.$("filtered").textContent.indexOf(p.box()) >= 0, true);
}
// ten dice per throw
{
  const p = page();
  p.$("dice").value = "10";
  p.$("dice").dispatchEvent(new p.w.Event("change", { bubbles: true }));
  p.settle();
  t("ten dice per throw needs 12 throws for 111 rolls", /12 throws of 10/.test(p.$("need").textContent), true);
  p.$("startReal").click(); p.settle();
  t("the grid is sized for 12 throws", p.w.document.querySelectorAll(".throw").length, 12);
  t("a box holds ten characters",
    p.w.document.querySelector(".throw input").getAttribute("maxlength"), "10");
  p.type("1234561234");
  t("a throw of ten commits on the tenth digit",
    p.w.document.querySelector(".throw.active").dataset.i, "1");
  t("ten pip dice render in one throw",
    p.w.document.querySelectorAll('.throw[data-i="0"] .die').length, 10);
  t("ten rolls counted", p.$("filtered").textContent.length, 10);
  const rs = p.w.document.documentElement.style;
  t("the shared cell is the die plus the gap", rs.getPropertyValue("--cell"), "16px");
  t("the box is wide enough for ten cells",
    parseInt(rs.getPropertyValue("--throwmin"), 10), 10 * 16 + 22);
}
// die type is available in simple mode, so there is no d6-only rule to trip over
{
  const p = page("#simple");
  t("simple mode offers the die selector", p.seen("dieType"), true);
  t("simple mode hides the imbalance selector", p.seen("pmax"), false);
  t("simple mode defaults to d6", p.$("dieType").value, "d6");
  t("simple mode explains the roll count", p.seen("needWhy"), true);
  t("the explanation names the fair count for the die",
    /more than the 100 a perfectly fair d6 would need/.test(p.$("needWhy").textContent), true);
  t("choosing a d8 in simple mode does not ask", p.change("dieType", "d8"), false);
  t("the d8 is applied in simple mode", p.$("dieType").value, "d8");
  t("the target follows the d8", /\b94 rolls\b/.test(p.$("need").textContent), true);
  t("the explanation follows the d8",
    /more than the 86 a perfectly fair d8 would need/.test(p.$("needWhy").textContent), true);
  t("simple mode warns that a d8 has no shared convention", p.seen("convNote"), true);
}
// a whole d8 seed in simple mode, gate and all
{
  const p = page("#simple");
  p.change("dieType", "d8");
  p.clickMode("real");
  t("the d8 grid is sized for 94 rolls of 5", p.w.document.querySelectorAll(".throw").length, 19);
  const eight = "12345678".repeat(12);
  p.type(eight.slice(0, 93));
  t("93 of 94 rolls still locks the phrase",
    p.$("phraseSec").className.indexOf("locked") >= 0, true);
  t("the stub shows d8 progress",
    /of 256 bits of min-entropy\. Keep rolling\.$/.test(p.$("phraseStub").textContent), true);
  p.type(eight.slice(93, 94));
  t("the 94th roll opens the phrase",
    p.$("phraseSec").className.indexOf("locked") >= 0, false);
  t("the phrase is 24 words", p.words().split(" ").length, 24);
  t("the roll string is 94 d8 rolls", p.$("filtered").textContent.length, 94);
  t("the digest matches the roll string",
    p.$("hexPlain").textContent, require("crypto").createHash("sha256")
      .update(p.$("filtered").textContent).digest("hex"));
  t("simple mode still hides the bits table", p.seen("tbody"), false);
  t("simple mode still hides step 3", p.seen("verifySec"), false);
}
// switching into simple mode mid-session no longer touches the die
{
  const p = page();
  p.change("dieType", "d8");
  p.clickMode("real");
  p.type("7812");
  t("switching to simple mode is accepted", (() => { p.tick("simpleChk", true); return p.$("simpleChk").checked; })(), true);
  t("the die survives the switch", p.$("dieType").value, "d8");
  t("the rolls survive the switch", p.$("filtered").textContent, "7812");
  t("the fragment is written", p.w.location.hash, "#simple");
  t("nothing was cleared", p.asking(), false);
  p.tick("simpleChk", false);
  t("and back again", p.$("filtered").textContent, "7812");
  t("the die is still the d8", p.$("dieType").value, "d8");
}

// dice per throw now clears rather than regroups, and the clear is total
{
  const p = page();
  p.clickMode("real");
  p.type(R111);
  t("baseline is the 111-roll fixture", p.$("hexPlain").textContent, DIGEST111);
  p.answerYes();
  p.change("dice", "10"); p.settle();
  t("the roll string is emptied", p.$("filtered").textContent, "");
  t("no box retains a digit",
    [...p.w.document.querySelectorAll("#throws .throw input")].every(i => i.value === ""), true);
  t("the first box is active again", p.w.document.querySelector(".throw.active").dataset.i, "0");
  t("stage 5 re-locks", p.$("phraseSec").className.indexOf("locked") >= 0, true);
  for (const id of ["filtered", "hexPlain", "phrase", "hexOut", "binOut", "tbody"])
    t("a clear blanks " + id, p.$(id).innerHTML, "");
  t("a clear resets the verified badge", p.$("vstate").textContent, "unverified");
  t("a clear unticks the attestation", p.$("attest").checked, false);
  t("a clear empties the digest compare field", p.$("check").value, "");
  t("rolling starts again cleanly", (() => { p.type("6"); return p.$("filtered").textContent; })(), "6");
}
// changing a declaration with rolls down: asks in the page, then clears
{
  const p = page();
  p.clickMode("real");
  p.type("53224231566356");
  const rolls = p.$("filtered").textContent;
  t("rolls are recorded", rolls.length, 14);

  t("a dice-per-throw change asks", p.change("dice", "10"), true);
  t("the question names the roll count",
    /clears the 14 rolls you have entered/.test(p.lastPrompt()), true);
  t("the selector reverts while the question is open", p.$("dice").value, "5");
  t("the rolls are untouched while the question is open", p.$("filtered").textContent, rolls);
  p.answerNo(); p.settle();
  t("declining closes the question", p.asking(), false);
  t("declining keeps the selector", p.$("dice").value, "5");
  t("declining keeps the rolls", p.$("filtered").textContent, rolls);

  t("a die change asks", p.change("dieType", "d8"), true);
  p.answerNo(); p.settle();
  t("declining a die change keeps the selector", p.$("dieType").value, "d6");
  t("declining a die change keeps the rolls", p.$("filtered").textContent, rolls);

  t("the change can be asked again", p.change("dice", "10"), true);
  p.answerYes(); p.settle();
  t("accepting applies the new grouping", p.$("dice").value, "10");
  t("accepting clears the rolls", p.$("filtered").textContent, "");
  t("accepting closes the question", p.asking(), false);
  t("accepting rebuilds the grid for the new size",
    p.w.document.querySelector(".throw input").getAttribute("maxlength"), "10");
  t("the grid is resized for the new throw count",
    p.w.document.querySelectorAll(".throw").length, 12);
  p.type("1234561234");
  t("the new grouping accepts a full throw of ten", p.$("filtered").textContent.length, 10);
  t("a throw of ten commits and moves on",
    p.w.document.querySelector(".throw.active").dataset.i, "1");
}
// phrase length and imbalance never clear, since they re-credit the same rolls
{
  const p = page();
  p.clickMode("real");
  p.type("531624");
  for (const [id, v] of [["words", "12"], ["pmax", "0.50"], ["words", "24"], ["pmax", "0"]])
    t("changing " + id + " to " + v + " never asks", p.change(id, v), false);
  t("phrase length and imbalance keep the rolls", p.$("filtered").textContent, "531624");
  t("the target follows the new imbalance", /\b100 rolls\b/.test(p.$("need").textContent), true);
}
// the blob is cleared by a die change, since its alphabet changed
{
  const p = page();
  p.clickMode("test");
  p.$("blob").value = "123456";
  p.$("blob").dispatchEvent(new p.w.Event("input", { bubbles: true }));
  t("dice per throw does not ask in blob mode", p.change("dice", "3"), false);
  t("dice per throw does not touch a blob", p.$("blob").value, "123456");
  t("a die change asks in blob mode", p.change("dieType", "d8"), true);
  p.answerNo(); p.settle();
  t("declining keeps the blob", p.$("blob").value, "123456");
  t("declining keeps the die", p.$("dieType").value, "d6");
  t("the die change asks again", p.change("dieType", "d8"), true);
  p.answerYes(); p.settle();
  t("accepting clears the blob", p.$("blob").value, "");
  t("accepting applies the die", p.$("dieType").value, "d8");
}
// nothing entered, so nothing to ask about
{
  const p = page();
  t("choosing real dice does not ask", p.clickMode("real"), false);
  t("a dice-per-throw change does not ask", p.change("dice", "8"), false);
  t("a die change does not ask", p.change("dieType", "d8"), false);
  t("switching mode does not ask", p.clickMode("test"), false);
  t("the die is applied", p.$("dieType").value, "d8");
  t("the dice per throw is applied", p.$("dice").value, "8");
  t("the mode is switched", p.$("startTest").className.indexOf("chosen") >= 0, true);
}
// a question about rolls that no longer exist withdraws itself
{
  const p = page();
  p.clickMode("real");
  p.type("53");
  t("the question is open", p.change("dieType", "d8"), true);
  const inp = p.w.document.querySelector(".throw.active input");
  for (let i = 0; i < 2; i++)
    inp.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
  t("erasing the last roll withdraws the question", p.asking(), false);
  t("the die is unchanged", p.$("dieType").value, "d6");
  t("the change then applies without asking", p.change("dieType", "d8"), false);
  t("the die is applied", p.$("dieType").value, "d8");
}

// the declared-up-front gate holds even against direct programmatic access
{
  const p = page();
  p.$("more").click();
  t("adding throws before declaring a mode builds no grid",
    p.w.document.querySelectorAll("#throws .throw").length, 0);
  t("and records nothing", p.$("filtered").textContent, "");
  p.$("throws").dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "6", bubbles: true, cancelable: true }));
  t("a keystroke before declaring a mode records nothing", p.$("filtered").textContent, "");
  t("stage 5 stays locked", p.$("phraseSec").className.indexOf("locked") >= 0, true);
  p.clickMode("real");
  p.type("6");
  t("after declaring, the same keystroke is recorded", p.$("filtered").textContent, "6");
  const before = p.w.document.querySelectorAll("#throws .throw").length;
  p.$("more").click();
  t("after declaring, more throws are added",
    p.w.document.querySelectorAll("#throws .throw").length, before + 10);
}

// the gate states what was chosen instead of vanishing
{
  const p = page();
  t("both paths are offered before choosing",
    p.seen("startReal") && p.seen("startTest"), true);
  t("no state line before choosing", p.seen("gateState"), false);
  p.$("startReal").click(); p.settle();
  t("the gate stays on screen after choosing", p.seen("gate"), true);
  t("both paths remain visible", p.seen("startReal") && p.seen("startTest"), true);
  t("the chosen path is marked", p.$("startReal").className.indexOf("chosen") >= 0, true);
  t("the other path is not marked", p.$("startTest").className.indexOf("chosen") >= 0, false);
  t("nothing locks before the first roll",
    p.$("startReal").disabled || p.$("startTest").disabled || p.$("dieType").disabled, false);
  t("the state line names real dice", /^Recording real dice\./.test(p.$("gateState").textContent), true);
  t("the state line says switching is free while empty",
    /Nothing entered yet, so switching costs nothing\./.test(p.$("gateState").textContent), true);
  t("the declare prompt is replaced rather than left stale", p.seen("gateNote"), false);
  // a misclick costs nothing
  p.$("startTest").click(); p.settle();
  t("test blob can be chosen after real dice", p.$("startTest").className.indexOf("chosen") >= 0, true);
  t("real dice is no longer marked", p.$("startReal").className.indexOf("chosen") >= 0, false);
  t("the blob area appears", p.seen("blob"), true);
  t("the throw grid goes away", p.seen("throws"), false);
  t("the test banner appears", p.w.document.getElementById("testbanner") !== null, true);
  p.$("startReal").click(); p.settle();
  t("real dice can be chosen again", p.$("startReal").className.indexOf("chosen") >= 0, true);
  t("the test banner is removed", p.w.document.getElementById("testbanner"), null);
  t("the throw grid comes back", p.seen("throws"), true);
  p.$("startTest").click(); p.settle(); p.$("startTest").click(); p.settle();
  t("choosing test twice leaves one banner",
    p.w.document.querySelectorAll("#testbanner").length, 1);
  // with rolls down, a switch asks first
  p.$("startReal").click(); p.settle();
  p.type("6");
  t("nothing is disabled once rolls exist",
    p.$("startReal").disabled || p.$("startTest").disabled || p.$("dieType").disabled || p.$("dice").disabled, false);
  t("the state line says a switch asks first",
    /Switching asks first, then clears your rolls\./.test(p.$("gateState").textContent), true);
  t("a mode switch asks once rolls exist", p.clickMode("test"), true);
  t("the question names the mode", /Changing to a test blob/.test(p.lastPrompt()), true);
  p.answerNo(); p.settle();
  t("a declined mode switch keeps the mode", p.$("startReal").className.indexOf("chosen") >= 0, true);
  t("a declined mode switch keeps the rolls", p.$("filtered").textContent, "6");
  t("a declined mode switch keeps the grid", p.seen("throws"), true);
  p.clickMode("test"); p.answerYes(); p.settle();
  t("an accepted mode switch changes the mode", p.$("startTest").className.indexOf("chosen") >= 0, true);
  t("an accepted mode switch clears the rolls", p.$("filtered").textContent, "");
}
{
  const p = page();
  p.$("startTest").click(); p.settle();
  t("the chosen path is marked for a test blob", p.$("startTest").className.indexOf("chosen") >= 0, true);
  t("the state line names the test blob", /Recording a test blob\./.test(p.$("gateState").textContent), true);
}
{
  const p = page("#simple");
  t("simple mode keeps the gate visible after choosing", (() => {
    p.$("startReal").click(); p.settle();
    return p.seen("gate") && p.seen("gateState");
  })(), true);
}

// ---- prose audit: nothing visible may cite an absent step or feature ----
{
  const visibleText = hash => {
    const p = page(hash);
    const out = [];
    (function walk(n) {
      if (n.nodeType === 3) { if (n.textContent.trim()) out.push(n.textContent); return; }
      if (n.nodeType !== 1) return;
      if (n.hasAttribute("hidden")) return;
      if (p.w.getComputedStyle(n).display === "none") return;
      for (const c of n.childNodes) walk(c);
    })(p.w.document.body);
    return out.join(" ").replace(/\s+/g, " ");
  };
  const simpleText = visibleText("#simple");
  t("simple mode cites no step above its last stage",
    [...new Set([...simpleText.matchAll(/step [4-9]/gi)].map(m => m[0]))].join(",") || "none", "none");
  t("simple mode offers no feature it dropped",
    ["print worksheet", "bit calculator", "printed BIP-39 wordlist", "paste the digest"]
      .filter(s2 => simpleText.toLowerCase().indexOf(s2) >= 0).join(",") || "none", "none");
  t("simple mode keeps the line about independent checking",
    /every step on this page can be checked independently/i.test(simpleText), true);
  t("full mode keeps the line about independent checking",
    /every step on this page can be checked independently/i.test(visibleText("")), true);
}

// The whole point: a sandboxed frame suppresses modals, so the page must never use
// one. Every confirmation above was answered by clicking a button in the page.
{
  const p = page();
  p.clickMode("real");
  p.type("531624");
  p.change("dieType", "d8"); p.answerYes(); p.settle();
  p.change("dice", "7");
  p.clickMode("test");
  t("no native dialog is ever used", p.nativeDialogs(), 0);
  t("the die change went through with modals suppressed", p.$("dieType").value, "d8");
}

console.log("");
console.log(pass + " passed, " + fail + " failed   (" + file + ")");
process.exit(fail ? 1 : 0);
