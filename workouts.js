"use strict";

/* Workouts tab: at-home exercise library with animated stick-figure demos.
   Each pose is 10 points in a 120x120 box (side view, facing right):
   [head, neck, shoulder, elbow, hand, pelvis, kneeA, footA, kneeB, footB].
   The player interpolates between the start pose and the peak pose. */

var POSES = {
  stand:        { g: 108, p: [[50,16],[50,27],[51,29],[51,43],[51,57],[50,60],[47,84],[46,106],[54,84],[55,106]] },
  squatTop:     { g: 108, p: [[50,18],[50,29],[51,31],[62,34],[74,36],[50,61],[49,84],[47,106],[55,84],[56,106]] },
  squatBottom:  { g: 108, p: [[58,36],[55,46],[56,48],[66,52],[76,56],[40,68],[58,86],[57,106],[52,86],[50,106]] },
  hingeBottom:  { g: 108, p: [[68,28],[60,38],[60,40],[56,56],[52,72],[38,58],[45,83],[46,106],[41,83],[39,106]] },
  splitTop:     { g: 108, p: [[48,14],[48,25],[49,27],[49,41],[49,55],[48,56],[62,79],[66,106],[32,81],[22,105]] },
  splitLow:     { g: 108, p: [[48,30],[48,41],[49,43],[49,57],[49,70],[48,72],[64,85],[66,106],[36,93],[24,105]] },
  lungeFwd:     { g: 108, p: [[48,16],[48,27],[49,29],[49,43],[49,57],[48,60],[66,81],[68,106],[30,84],[20,104]] },
  lungeBack:    { g: 108, p: [[48,16],[48,27],[49,29],[49,43],[49,57],[48,60],[30,84],[20,104],[66,81],[68,106]] },
  wallLeanTop:  { g: 108, props: [[100,8],[100,112]], p: [[36,20],[40,30],[41,32],[62,32],[88,34],[33,62],[29,86],[25,107],[35,86],[32,107]] },
  wallLeanBot:  { g: 108, props: [[100,8],[100,112]], p: [[42,25],[45,34],[46,36],[60,45],[88,34],[33,62],[29,86],[25,107],[35,86],[32,107]] },
  pushupTop:    { g: 92,  p: [[16,42],[25,47],[26,49],[25,66],[24,86],[58,54],[78,68],[95,84],[76,73],[93,90]] },
  pushupBottom: { g: 92,  p: [[16,50],[25,55],[26,57],[13,68],[24,86],[58,62],[78,70],[95,84],[76,75],[93,90]] },
  kneePushTop:  { g: 92,  p: [[16,42],[25,47],[26,49],[25,66],[24,86],[52,52],[66,84],[80,68],[63,86],[77,72]] },
  kneePushBot:  { g: 92,  p: [[16,50],[25,55],[26,57],[13,68],[24,86],[52,60],[66,84],[80,68],[63,86],[77,72]] },
  pikeTop:      { g: 92,  p: [[20,58],[28,56],[29,57],[28,72],[27,88],[52,34],[66,62],[82,86],[64,66],[80,90]] },
  pikeBottom:   { g: 92,  p: [[17,66],[26,62],[27,63],[15,74],[27,88],[52,40],[66,64],[82,86],[64,68],[80,90]] },
  declineTop:   { g: 92,  props: [[86,60],[112,60],[86,60],[86,92],[112,60],[112,92]], p: [[14,44],[23,48],[24,50],[23,66],[22,86],[54,54],[74,58],[94,58],[72,62],[92,62]] },
  declineBot:   { g: 92,  props: [[86,60],[112,60],[86,60],[86,92],[112,60],[112,92]], p: [[14,52],[23,56],[24,58],[12,68],[22,86],[54,62],[74,60],[94,58],[72,64],[92,62]] },
  forearmPlank: { g: 94,  p: [[16,56],[25,60],[26,61],[24,78],[38,86],[58,62],[78,74],[95,88],[76,79],[93,92]] },
  plankSag:     { g: 94,  p: [[16,58],[25,62],[26,63],[24,79],[38,87],[58,68],[78,76],[95,88],[76,81],[93,92]] },
  rowHang:      { g: 102, props: [[40,30],[98,30],[44,30],[44,44],[94,30],[94,44]], p: [[18,74],[27,71],[28,70],[36,52],[44,34],[58,80],[76,88],[94,96],[74,92],[92,100]] },
  rowPull:      { g: 102, props: [[40,30],[98,30],[44,30],[44,44],[94,30],[94,44]], p: [[22,66],[30,64],[30,63],[18,54],[44,34],[58,74],[76,84],[94,96],[74,88],[92,100]] },
  strapHang:    { g: 102, props: [[38,2],[44,34],[56,2],[50,34]], p: [[18,74],[27,71],[28,70],[36,52],[47,36],[58,80],[76,88],[94,96],[74,92],[92,100]] },
  strapPull:    { g: 102, props: [[38,2],[44,34],[56,2],[50,34]], p: [[22,66],[30,64],[30,63],[18,54],[47,36],[58,74],[76,84],[94,96],[74,88],[92,100]] },
  doorLean:     { g: 108, props: [[92,6],[92,112]], p: [[36,18],[38,29],[39,31],[64,30],[89,32],[31,60],[28,84],[26,106],[36,84],[35,106]] },
  doorPull:     { g: 108, props: [[92,6],[92,112]], p: [[44,16],[45,27],[46,29],[56,40],[89,32],[38,58],[33,84],[28,106],[40,84],[37,106]] },
  pullupHang:   { g: 0,   props: [[18,12],[86,12]], p: [[50,30],[50,40],[50,42],[47,26],[45,13],[50,72],[47,95],[46,114],[54,95],[55,114]] },
  pullupTop:    { g: 0,   props: [[18,12],[86,12]], p: [[50,15],[50,26],[50,28],[37,19],[45,13],[50,58],[47,82],[46,102],[54,82],[55,102]] },
  dipTop:       { g: 110, props: [[6,64],[30,64],[9,64],[9,108],[27,64],[27,108]], p: [[48,22],[48,33],[48,35],[38,48],[28,63],[50,66],[64,86],[66,107],[58,88],[58,108]] },
  dipBottom:    { g: 110, props: [[6,64],[30,64],[9,64],[9,108],[27,64],[27,108]], p: [[48,34],[48,45],[48,47],[33,42],[28,63],[50,80],[64,92],[66,107],[58,94],[58,108]] },
  lyingFlat:    { g: 112, p: [[14,98],[23,99],[24,100],[32,105],[41,104],[50,100],[68,102],[86,105],[66,106],[84,109]] },
  bridgeUp:     { g: 112, p: [[14,94],[23,95],[24,96],[30,103],[38,108],[52,74],[68,84],[80,108],[64,88],[76,110]] },
  deadBugA:     { g: 112, p: [[14,98],[23,99],[24,99],[22,84],[20,70],[50,100],[58,78],[72,64],[62,80],[76,68]] },
  deadBugB:     { g: 112, p: [[14,98],[23,99],[24,99],[13,90],[4,84],[50,100],[70,95],[90,100],[62,80],[76,68]] },
  hollow:       { g: 112, p: [[16,94],[24,96],[24,97],[12,88],[3,81],[50,99],[68,85],[86,75],[66,89],[84,79]] },
  bearA:        { g: 106, p: [[24,62],[31,68],[32,70],[31,86],[30,102],[64,66],[72,86],[74,102],[66,88],[66,104]] },
  bearB:        { g: 106, p: [[24,62],[31,68],[32,70],[33,86],[38,102],[64,66],[68,86],[64,102],[70,88],[74,104]] },
  calfDown:     { g: 108, p: [[50,16],[50,27],[51,29],[51,43],[51,57],[50,60],[47,84],[46,106],[54,84],[55,106]] },
  calfUp:       { g: 108, p: [[50,10],[50,21],[51,23],[51,37],[51,51],[50,54],[47,78],[46,100],[54,78],[55,100]] },
  wallSitStart: { g: 108, props: [[12,8],[12,112]], p: [[26,16],[26,27],[27,29],[27,43],[27,57],[26,60],[25,84],[24,106],[31,84],[32,106]] },
  wallSit:      { g: 108, props: [[12,8],[12,112]], p: [[24,28],[24,39],[25,41],[25,55],[25,68],[26,66],[49,68],[49,106],[43,70],[43,106]] },
  stepStand:    { g: 108, props: [[64,84],[98,84],[64,84],[64,108],[98,84],[98,108]], p: [[44,16],[44,27],[45,29],[45,43],[45,57],[44,60],[42,84],[41,106],[49,84],[50,106]] },
  stepUp:       { g: 108, props: [[64,84],[98,84],[64,84],[64,108],[98,84],[98,108]], p: [[52,8],[52,19],[53,21],[53,35],[53,49],[52,50],[66,64],[80,82],[40,72],[34,88]] },
  mountA:       { g: 92,  p: [[16,42],[25,47],[26,49],[25,66],[24,86],[56,52],[52,68],[56,82],[76,70],[93,88]] },
  mountB:       { g: 92,  p: [[16,42],[25,47],[26,49],[25,66],[24,86],[56,52],[76,70],[93,88],[52,68],[56,82]] },
  jackClosed:   { g: 108, p: [[50,16],[50,27],[50,29],[50,43],[50,57],[50,60],[49,84],[48,106],[52,84],[53,106]] },
  jackOpen:     { g: 108, p: [[50,14],[50,25],[51,27],[62,13],[70,3],[50,58],[42,82],[36,105],[59,82],[65,105]] },
  kneeAUp:      { g: 108, p: [[50,14],[50,25],[51,27],[59,35],[65,25],[50,58],[57,56],[55,72],[53,82],[54,106]] },
  kneeBUp:      { g: 108, p: [[50,14],[50,25],[51,27],[43,35],[37,25],[50,58],[48,82],[47,106],[58,56],[56,72]] },
  bulgTop:      { g: 108, props: [[2,72],[24,72],[5,72],[5,108],[21,72],[21,108]], p: [[48,14],[48,25],[49,27],[49,41],[49,55],[48,56],[62,79],[66,106],[34,80],[14,70]] },
  bulgLow:      { g: 108, props: [[2,72],[24,72],[5,72],[5,108],[21,72],[21,108]], p: [[48,30],[48,41],[49,43],[49,57],[49,70],[48,72],[64,85],[66,106],[38,90],[14,70]] }
};

/* Segments connect point indices: neck-shoulder, shoulder-elbow, elbow-hand,
   neck-pelvis (torso), pelvis-kneeA, kneeA-footA, pelvis-kneeB, kneeB-footB. */
var SEGMENTS = [[1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [5, 8], [8, 9]];

var EXERCISES = [
  /* Push */
  { name: "Wall Push-Up", group: "Push", level: "Beginner", equip: "Wall", sets: "2–3 sets of 10–15", a: "wallLeanTop", b: "wallLeanBot", start: "Arms straight, hands flat on the wall, body in one straight line.", peak: "Bend your elbows until your nose nearly touches the wall, then press back." },
  { name: "Incline Push-Up", group: "Push", level: "Beginner", equip: "Chair, counter, or sturdy table edge", sets: "2–3 sets of 8–12", a: "pushupTop", b: "pushupBottom", start: "Hands on the raised surface, body straight from head to heels.", peak: "Lower your chest to the edge, elbows about 45 degrees from your body." },
  { name: "Knee Push-Up", group: "Push", level: "Beginner", equip: "None (floor)", sets: "2–3 sets of 8–15", a: "kneePushTop", b: "kneePushBot", start: "Knees on the floor, hands under shoulders, straight line from head to knees.", peak: "Lower until your chest is a fist's height from the floor." },
  { name: "Push-Up", group: "Push", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 8–20", a: "pushupTop", b: "pushupBottom", start: "High plank: hands under shoulders, body rigid, glutes tight.", peak: "Chest to a fist's height from the floor, then press the floor away." },
  { name: "Wide Push-Up", group: "Push", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 8–15", a: "pushupTop", b: "pushupBottom", start: "Hands about 1.5× shoulder width, body in one line.", peak: "Lower with control — the wide grip loads the chest harder." },
  { name: "Diamond Push-Up", group: "Push", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 6–12", a: "pushupTop", b: "pushupBottom", start: "Hands together under your sternum, thumbs and index fingers forming a diamond.", peak: "Lower until your chest touches your hands — triceps do the work." },
  { name: "Pike Push-Up", group: "Push", level: "Advanced", equip: "None (floor)", sets: "3 sets of 6–12", a: "pikeTop", b: "pikeBottom", start: "Hips high in an upside-down V, hands under shoulders.", peak: "Lower the top of your head toward the floor between your hands — this is the shoulder builder." },
  { name: "Decline Push-Up", group: "Push", level: "Advanced", equip: "Chair or step for your feet", sets: "3 sets of 8–15", a: "declineTop", b: "declineBot", start: "Feet up on the chair, hands on the floor, body straight.", peak: "Lower your chest to the floor — the raised feet shift load to the upper chest and shoulders." },
  { name: "Chair Dip", group: "Push", level: "Intermediate", equip: "Sturdy chair", sets: "3 sets of 8–15", a: "dipTop", b: "dipBottom", start: "Hands on the chair edge behind you, arms straight, legs bent.", peak: "Lower until your upper arms are about parallel to the floor, then press up." },

  /* Pull */
  { name: "Doorframe Row", group: "Pull", level: "Beginner", equip: "Sturdy doorframe", sets: "2–3 sets of 10–15", a: "doorLean", b: "doorPull", start: "Grip the frame, lean back with straight arms and a rigid body.", peak: "Pull your chest toward the frame, squeezing your shoulder blades together." },
  { name: "Table Row (Inverted Row)", group: "Pull", level: "Intermediate", equip: "Sturdy table", sets: "3 sets of 8–15", a: "rowHang", b: "rowPull", start: "Under the table, grip the edge, body straight, heels on the floor.", peak: "Pull your chest to the table edge, elbows driving back." },
  { name: "Ring Row", group: "Pull", level: "Intermediate", equip: "Gymnastics rings or straps", sets: "3 sets of 8–15", a: "strapHang", b: "strapPull", start: "Lean back holding the rings, arms straight, body in one line. Walk your feet forward to make it harder.", peak: "Pull the rings to your ribs, chest tall." },
  { name: "Negative Pull-Up", group: "Pull", level: "Intermediate", equip: "Pull-up bar or sturdy beam", sets: "3 sets of 3–5 slow lowers", a: "pullupTop", b: "pullupHang", start: "Jump or step up so your chin is over the bar.", peak: "Lower yourself as slowly as you can — aim for 3–5 seconds — until your arms are straight." },
  { name: "Pull-Up", group: "Pull", level: "Advanced", equip: "Pull-up bar or sturdy beam", sets: "3 sets of 3–10", a: "pullupHang", b: "pullupTop", start: "Dead hang, overhand grip just outside shoulder width.", peak: "Pull until your chin clears the bar, then lower under control." },
  { name: "Chin-Up", group: "Pull", level: "Advanced", equip: "Pull-up bar or sturdy beam", sets: "3 sets of 3–10", a: "pullupHang", b: "pullupTop", start: "Dead hang, underhand grip (palms facing you) at shoulder width.", peak: "Pull your chin over the bar — the underhand grip brings the biceps in." },

  /* Legs & Core */
  { name: "Bodyweight Squat", group: "Legs & Core", level: "Beginner", equip: "None", sets: "3 sets of 12–20", a: "squatTop", b: "squatBottom", start: "Feet shoulder width, arms reaching forward for balance.", peak: "Hips down to about knee height, knees tracking over toes, chest up." },
  { name: "Split Squat", group: "Legs & Core", level: "Intermediate", equip: "None", sets: "3 sets of 8–12 per leg", a: "splitTop", b: "splitLow", start: "Long staggered stance, torso tall.", peak: "Drop straight down until the front thigh is parallel, then drive through the front heel." },
  { name: "Bulgarian Split Squat", group: "Legs & Core", level: "Advanced", equip: "Chair or step behind you", sets: "3 sets of 6–10 per leg", a: "bulgTop", b: "bulgLow", start: "Top of your rear foot rests on the chair, front foot well forward.", peak: "Lower until the front thigh is parallel — keep the torso tall." },
  { name: "Reverse Lunge", group: "Legs & Core", level: "Intermediate", equip: "None", sets: "3 sets of 8–12 per leg", a: "splitTop", b: "splitLow", start: "Standing tall, feet together (shown mid-stride). Step one leg back.", peak: "Lower until both knees are near 90 degrees, then push back to standing." },
  { name: "Step-Up", group: "Legs & Core", level: "Intermediate", equip: "Chair or sturdy step", sets: "3 sets of 8–12 per leg", a: "stepStand", b: "stepUp", start: "One foot flat on the step, hands free for balance.", peak: "Drive through the top leg to stand tall on the step — avoid pushing off the floor leg." },
  { name: "Wall Sit", group: "Legs & Core", level: "Beginner", equip: "Wall", sets: "3 holds of 20–60 seconds", a: "wallSitStart", b: "wallSit", start: "Back flat against the wall, feet about two feet out.", peak: "Slide down until thighs are parallel to the floor and hold — knees over ankles." },
  { name: "Bodyweight Hip Hinge", group: "Legs & Core", level: "Beginner", equip: "None (a wall behind helps)", sets: "3 sets of 12–15", a: "stand", b: "hingeBottom", start: "Standing tall, soft knees, hands on your thighs.", peak: "Push your hips back until your hamstrings pull tight, back flat — then snap the hips through." },
  { name: "Glute Bridge", group: "Legs & Core", level: "Beginner", equip: "None (floor)", sets: "3 sets of 12–20", a: "lyingFlat", b: "bridgeUp", start: "On your back, knees bent, feet flat, arms by your sides.", peak: "Drive through your heels and squeeze your glutes until hips, knees, and shoulders line up." },
  { name: "Single-Leg Glute Bridge", group: "Legs & Core", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 8–12 per leg", a: "lyingFlat", b: "bridgeUp", start: "Same bridge setup, but one leg extended toward the ceiling.", peak: "Bridge up on the planted leg, keeping your pelvis level." },
  { name: "Calf Raise", group: "Legs & Core", level: "Beginner", equip: "None (wall for balance)", sets: "3 sets of 15–25", a: "calfDown", b: "calfUp", start: "Standing tall, feet flat, light touch on the wall.", peak: "Press through the balls of your feet to full height, pause, lower slowly." },
  { name: "Forearm Plank", group: "Legs & Core", level: "Beginner", equip: "None (floor)", sets: "3 holds of 20–60 seconds", a: "forearmPlank", b: "plankSag", start: "Forearms down, elbows under shoulders, body in one long line.", peak: "Hold the line — brace your abs and glutes so your lower back never sags (the sag shown is what to avoid)." },
  { name: "Dead Bug", group: "Legs & Core", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 6–10 per side", a: "deadBugA", b: "deadBugB", start: "On your back, arms up, hips and knees at 90 degrees, lower back pressed into the floor.", peak: "Extend the opposite arm and leg without your back arching, then switch." },
  { name: "Hollow Body Hold", group: "Legs & Core", level: "Advanced", equip: "None (floor)", sets: "3 holds of 15–40 seconds", a: "lyingFlat", b: "hollow", start: "Lying flat, arms by your ears.", peak: "Lift arms, head, and legs into a shallow banana shape, lower back glued to the floor — and hold." },

  /* Full-Body */
  { name: "Jumping Jack", group: "Full-Body", level: "Beginner", equip: "None", sets: "3 sets of 30–60 seconds", a: "jackClosed", b: "jackOpen", start: "Standing tall, arms at your sides, feet together.", peak: "Jump feet wide as your arms sweep overhead, then jump back together." },
  { name: "Inchworm", group: "Full-Body", level: "Intermediate", equip: "None", sets: "3 sets of 5–8", a: "stand", b: "pushupTop", start: "Standing tall (hinge down to touch the floor from here).", peak: "Walk your hands out to a full plank, pause, then walk them back and stand." },
  { name: "Mountain Climber", group: "Full-Body", level: "Intermediate", equip: "None (floor)", sets: "3 sets of 20–40 seconds", a: "mountA", b: "mountB", start: "High plank, hands under shoulders, body straight.", peak: "Drive one knee toward your chest, then switch fast without bouncing your hips." },
  { name: "Bear Crawl", group: "Full-Body", level: "Intermediate", equip: "None (floor space)", sets: "3 sets of 20–40 seconds", a: "bearA", b: "bearB", start: "On all fours, knees hovering just off the floor, back flat.", peak: "Step the opposite hand and foot forward together, hips low and level." },
  { name: "High Knees", group: "Full-Body", level: "Intermediate", equip: "None", sets: "3 sets of 20–40 seconds", a: "kneeAUp", b: "kneeBUp", start: "Standing tall, ready to run in place.", peak: "Drive each knee to hip height, pumping the opposite arm — stay on the balls of your feet." },
  { name: "Burpee", group: "Full-Body", level: "Advanced", equip: "None", sets: "3 sets of 6–12", a: "stand", b: "pushupTop", start: "Standing tall — squat down and put your hands on the floor from here.", peak: "Jump your feet back to a plank (add a push-up for the full version), jump them in, and leap up." },
  { name: "Skater Jump", group: "Full-Body", level: "Advanced", equip: "None", sets: "3 sets of 16–24 total", a: "lungeFwd", b: "lungeBack", start: "Balanced on one leg, knee soft, ready to bound sideways.", peak: "Land on the other leg like a speed skater, trailing leg sweeping behind — stick each landing." }
];

window.Workouts = (function () {

  /* UI-chrome translation via the shared dictionary (i18n.js); exercise
     names and instructions are content and stay as authored. */
  function wkText(key) {
    if (window.i18nLookup) return window.i18nLookup(document.documentElement.lang || "en", key);
    return key;
  }
  var figures = [];
  var active = false;
  var rafId = null;
  var filter = "All";

  function interp(a, b, k) {
    return a + (b - a) * k;
  }
  function ease(k) { return k * k * (3 - 2 * k); }

  function buildCard(ex, idx) {
    var pa = POSES[ex.a], pb = POSES[ex.b];
    var props = (pa.props || pb.props || []);
    var svg = '<svg viewBox="0 0 120 120" role="img" aria-label="Animated demonstration of ' + esc(ex.name) + '">';
    props.forEach(function (pr) {
      svg += '<line class="wk-prop" x1="' + pr[0] + '" y1="' + pr[1] + '" x2="' + pr[0 + 2] + '" y2="' + pr[1 + 2] + '"/>';
    });
    if (pa.g) svg += '<line class="wk-ground" x1="2" y1="' + pa.g + '" x2="118" y2="' + pa.g + '"/>';
    SEGMENTS.forEach(function (s, si) {
      svg += '<line class="wk-fig seg" data-seg="' + si + '"/>';
    });
    svg += '<circle class="wk-fig-head" data-head="1" r="6.5"/>';
    svg += "</svg>";

    var card = document.createElement("div");
    card.className = "wk-card";
    card.setAttribute("data-group", ex.group);
    card.innerHTML =
      '<div class="row space-between"><h3>' + esc(ex.name) + '</h3><span class="wk-level">' + esc(ex.level) + "</span></div>" +
      '<div class="wk-meta">' + esc(ex.group) + " · " + esc(ex.equip) + "</div>" +
      '<div class="wk-stage">' + svg + "</div>" +
      '<div class="wk-caps">' +
      '<span data-cap="start"><strong>Start:</strong> ' + esc(ex.start) + "</span>" +
      '<span data-cap="peak"><strong>Peak:</strong> ' + esc(ex.peak) + "</span>" +
      "</div>" +
      '<div class="wk-sets">' + esc(ex.sets) + "</div>" +
      '<div class="wk-controls"><button type="button" class="btn btn-small" data-pause="' + idx + '">' + wkText("wk.pause") + "</button></div>";

    var lines = card.querySelectorAll("line.seg");
    var head = card.querySelector("[data-head]");
    var fig = {
      ex: ex, pa: pa, pb: pb, lines: lines, head: head,
      caps: { start: card.querySelector('[data-cap="start"]'), peak: card.querySelector('[data-cap="peak"]') },
      playing: true, offset: idx * 0.37, lastK: -1
    };
    figures.push(fig);
    card.querySelector("[data-pause]").addEventListener("click", function () {
      fig.playing = !fig.playing;
      this.textContent = fig.playing ? wkText("wk.pause") : wkText("wk.play");
    });
    return card;
  }

  function drawFigure(fig, t) {
    if (!fig.playing) return;
    var cycle = 1700; // ms for one direction
    var phase = ((t / cycle) + fig.offset) % 2;
    var raw = phase < 1 ? phase : 2 - phase;
    var k = ease(raw);
    var A = fig.pa.p, B = fig.pb.p;
    var pts = A.map(function (pt, i) {
      return [interp(pt[0], B[i][0], k), interp(pt[1], B[i][1], k)];
    });
    SEGMENTS.forEach(function (s, si) {
      var ln = fig.lines[si];
      ln.setAttribute("x1", pts[s[0]][0].toFixed(1));
      ln.setAttribute("y1", pts[s[0]][1].toFixed(1));
      ln.setAttribute("x2", pts[s[1]][0].toFixed(1));
      ln.setAttribute("y2", pts[s[1]][1].toFixed(1));
    });
    fig.head.setAttribute("cx", pts[0][0].toFixed(1));
    fig.head.setAttribute("cy", (pts[0][1] - 2).toFixed(1));
    var atPeak = k > 0.5;
    if ((fig.lastK > 0.5) !== atPeak || fig.lastK === -1) {
      fig.caps.start.classList.toggle("cap-on", !atPeak);
      fig.caps.peak.classList.toggle("cap-on", atPeak);
    }
    fig.lastK = k;
  }

  function loop(t) {
    if (!active) { rafId = null; return; }
    figures.forEach(function (f) { drawFigure(f, t); });
    rafId = requestAnimationFrame(loop);
  }

  function setActive(on) {
    active = on;
    if (on && !rafId) rafId = requestAnimationFrame(loop);
    if (!on && rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function applyFilter() {
    document.querySelectorAll(".wk-card").forEach(function (card) {
      card.style.display = (filter === "All" || card.getAttribute("data-group") === filter) ? "" : "none";
    });
  }

  function init() {
    var list = document.getElementById("wk-list");
    if (!list) return;
    EXERCISES.forEach(function (ex, idx) { list.appendChild(buildCard(ex, idx)); });
    document.querySelectorAll("[data-wk-group]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-wk-group");
        document.querySelectorAll("[data-wk-group]").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        applyFilter();
      });
    });
    // Draw one static frame so cards look right before the tab is opened.
    figures.forEach(function (f) { var was = f.playing; f.playing = true; drawFigure(f, 400 + f.offset * 800); f.playing = was; });
  }

  document.addEventListener("DOMContentLoaded", init);
  return { setActive: setActive };
})();

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
