# Gamification and animated characters for openGym

Research brief, 20 October 2026. Every factual claim links to its source. Lines marked **[unverified]** could not be confirmed this session: the page was blocked, the fetch failed, or the claim is from background knowledge. Treat them as leads to check.

---

## 0. Summary

1. **Gamified exercise works, but modestly, and the effect fades.** A meta-analysis of 16 RCTs found a small-to-medium effect on physical activity (Hedges g = 0.42). Against non-gamified programmes the effect drops to g = 0.23, and about 14 weeks after the intervention ends it falls to g = 0.15 ([Mazeas et al. 2022, JMIR](https://www.jmir.org/2022/1/E26779/)). Pokémon GO raised walking by about 11 minutes a day, and the gain had faded after about six weeks ([Smithsonian on Howe et al., BMJ](https://www.smithsonianmag.com/smart-news/pokemon-go-craze-had-health-benefits-little-while-180961486/)). Plan for novelty to wear off at around 4–6 weeks ([Rodrigues et al. 2022](https://www.universityxp.com/research/2022/10/3/gamification-suffers-from-the-novelty-effect-but-benefits-from-the-familiarization-effect-findings-from-a-longitudinal-study)), and make the system still feel good after that.
2. **Forgiveness beats punishment.** Duolingo found that more Streak Freezes raised activity ([Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)). Built-in "emergency reserves" improved goal success by up to 40% ([Sharif & Shu, UCLA Anderson Review](https://anderson-review.ucla.edu/emergency-reserves/)). Broken streaks often cause people to quit altogether ([CU Boulder on Silverman & Barasch 2023](https://www.colorado.edu/business/news/2023/04/20/research-streaks-marketing-tech-barasch)).
3. **For a lifter, the streak should be weekly, not daily.** openGym's `streakWeeks` already counts weeks, which is the right base.
4. **Never reward eating less.** Diet apps that praise staying under budget and flash red when you go over are linked to fixation, guilt and restriction ([Eikey 2021, BJPsych Bulletin](https://icdicd-11-for-mental-and-behavioural-disorders.readthedocs.io/projects/bjpsych-bull/2021/PMC8485346.xml.html)). Reward logging, protein and being inside a range instead.
5. **The character should grow and never die or wither.** Users of Fish'n'Steps felt guilty when their fish looked sad, and some avoided the app because of it ([review, arXiv 1509.05238](https://arxiv.org/pdf/1509.05238)). Finch's bird never goes hungry or gets hurt, and its users praise it for exactly that ([MetaFilter thread](https://metafilter.com/207203/Habit-forming-for-good-with-Finch)).

---

## 1. How successful apps do it

### Duolingo (Duo, streaks, XP, leagues, gems, freezes, notifications)

- **Streak:** the count of consecutive days with at least one lesson. In late 2019 Duolingo separated "extend streak" (one lesson) from "reach daily goal". In an A/B test this raised day-14 retention by 3.3% (relative) and grew the number of learners on a 7+ day streak by over 40% ([Improving the streak](https://blog.duolingo.com/improving-the-streak)). **Lesson: keep the streak's bar low and separate from volume.** An early version tied streaks to XP, which confused users ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks)).
- **Streak Freeze:** pauses the streak for one missed day. Letting learners equip two freezes raised daily active learners by 0.38% "without encouraging more days off". Learners on a 7-day streak are 3.6× more likely to finish their course ([How the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit)). *The 3.6× figure is correlational, since committed learners both keep streaks and finish courses. Treat it as marketing, not a causal result.*
- **Loss aversion, used on purpose:** Duolingo's own blog says that later in a streak it "draws on loss aversion" so learners practise to protect their progress, and it admits a broken streak can demotivate ([blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)). Duolingo has run more than 600 streak experiments ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks)).
- **Leagues:** a 7-day XP leaderboard for 30 users across 10 tiers (Bronze to Diamond). Promotion rates shrink as you climb, and Monday notifications such as "Miller took your spot" use fear of demotion. The analysis site's headline "+25%" lift has no supporting data in the article, so treat it as marketing ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/leagues)). **Not relevant for a single-user self-hosted app.**
- **Gems:** the soft currency. Top-3 league finishers earn 60 gems, and a "League Repair" costs 2,000 ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/leagues)). Freeze prices in gems were not verified **[unverified]**.
- **Duo's expressions:** the 2019 redesign rebuilt Duo from simple geometric shapes (half-circle wings, capsule feet) so he could be animated. He went from "impassive" to showing excitement, happiness and sadness. The art director said a "broader range of emotions would allow the user to develop more of a relationship with him", and a crying Duo appears in emails to lapsed users ([Design Week](https://www.designweek.co.uk/issues/2-6-january-2019/duolingo-owl-receives-makeover-as-app-becomes-more-gamified)).
- **Guilt notifications:** examples include "Keep Duo happy!" and "These reminders don't seem to be working. We'll stop sending them for now." Users describe them as passive-aggressive and guilt-inducing ([Debugger/Medium](https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0)). Duolingo picks reminders with a bandit algorithm trained on about 200 million notifications. It found that new messages lose force over time (a novelty effect), so it rests recently seen ones. Duolingo itself acknowledges users "felt a bit guilty" swiping Duo away ([Duolingo blog](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/)).
- **Two personas:** the communications head calls the strategy "wholesome unhinged". Duo is "wacky" on social media but a "wholesome", encouraging coach inside the app ([Campaign](https://campaignlive.com/article/duolingo-comms-head-sam-dalsimer-leads-wholesome-unhinged-strategy/1910699)). In February 2025 Duolingo "killed" Duo, and users revived him by doing lessons ([Daily Tar Heel](https://1893.dailytarheel.com/the-day-duo-died-and-gen-z-went-crazy/)). That stunt depends on scale and memes and does not transfer to a personal app.
- **What backfires:** guilt and streak anxiety. Critics single out "You made Duo sad" messages as a sign of guilt-driven engagement ([The Decision Lab](https://thedecisionlab.com/es-ES/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)).

### Finch (self-care pet bird)

- **What it does:** you hatch and name a bird and choose its personality. Small self-chosen goals ("stand up for 10 seconds") earn energy, and each good day reveals more of its personality ([Pratt IXD critique](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/)). The bird spends energy on adventures, and you buy outfits and decor ([Headway review](https://makeheadway.com/blog/finch-app-review/)).
- **Failure:** there is no penalty for missed days ([Headway](https://makeheadway.com/blog/finch-app-review/)). The bird "will neither go hungry nor get hurt" ([MetaFilter](https://metafilter.com/207203/Habit-forming-for-good-with-Finch)). One reviewer sums up the pitch as caring for a pet "minus the guilt when you forget to feed it" ([Screenwise](https://screenwiseapp.com/media/finch-app)).
- **What works and what backfires:** users say it is the only habit app they kept using, and they like the gentle tone. Long task lists turn it into a chore, evening tasks only pay off the next morning, and some find the style too cute ([MetaFilter](https://metafilter.com/207203/Habit-forming-for-good-with-Finch); [Headway](https://makeheadway.com/blog/finch-app-review/)).

### Habitica (pixel RPG)

- **Trigger:** completing to-dos, dailies and good habits earns XP, gold and loot. **Failure:** missed dailies cost HP. At 0 HP you lose a level, all your gold and one piece of gear ([Habitica wiki: Death](https://habitica.fandom.com/wiki/Death)). In a party, your misses also damage your friends ([MakerStack](https://makerstack.co/reviews/habitica-review/)).
- **Release valve:** "Pause Damage" (formerly Rest in the Inn) stops penalties while you keep earning rewards, and your avatar shows "Zzz" ([Habitica wiki](https://habitica.fandom.com/wiki/Rest_in_the_Inn)).
- **Reviews:** social accountability is its strongest feature. The novelty wears off for some after a few months, and some users find it juvenile ([MakerStack](https://makerstack.co/reviews/habitica-review/)).

### Pokémon GO and Pokémon Sleep

- **GO, Adventure Sync:** counts walking in the background via Apple Health or Google Fit and turns distance into Candy, egg hatches and weekly milestone rewards ([Pokémon GO news](https://pokemongo.com/news/adventure-sync)). The research summary is the same as above: about 11 more minutes of walking a day, fading after about six weeks ([Smithsonian](https://www.smithsonianmag.com/smart-news/pokemon-go-craze-had-health-benefits-little-while-180961486/)).
- **Sleep:** your Sleep Score multiplies your Snorlax's strength to give "Drowsy Power", which attracts Pokémon. You get a new Snorlax each week, and there is no failure mechanic. The reviewer's worry was that the three-times-a-day feeding cycle could become busywork ([Serebii preview](https://serebii.net/pokemonsleep/preview/)). **Lesson: a weekly reset with no punishment.**

### Zombies, Run!

- An audio story plays between your music. Runs advance missions and collect supplies that build your base. Random chases make you speed up, and being caught costs supplies, never your progress or life ([GeekDad review](https://geekdad.com/2015/05/zombies-run/)).
- **What works:** the reviewer says the story was what "consistently got him to run". **What backfires:** base-building has no effect on the story, so the meta-game feels hollow (commenters, same source).

### Apple Fitness rings and awards

- Before watchOS 11, missing days through illness wiped long streaks, and users felt punished. watchOS 11 added ring pauses for "a day, week, month, or more" that do not break award streaks, plus different goals for each weekday ([BGR](https://bgr.com/tech/with-watchos-11-pausing-my-activity-rings-wont-make-me-feel-bad-about-myself-anymore/)). **Lesson: rest and illness must be first-class.**

### Strava

- Kudos, segment crowns, Local Legends and club mileage leaderboards. Users report altering easy runs to chase "a crown that doesn't actually mean anything", hiding bad workouts, and getting injured from streaks that skip rest ([Fatherly](https://www.fatherly.com/health/the-strava-strain)). **Lesson: avoid rewards that push volume or intensity beyond your plan.**

### Forest

- A tree grows while you stay off your phone and dies if you leave the app. Coins can fund real trees, with over 2 million planted ([Wikipedia](https://en.wikipedia.org/wiki/Forest_(application))). A death mechanic suits a 25-minute focus session but would be harsh for a multi-day habit.

### Tamagotchi-style pets: Plant Nanny, Fish'n'Steps, UbiFit Garden

- **Plant Nanny:** you water a plant as you drink. If you forget, it "shrinks and takes on a sad heartbreaking face". It also warns when you drink too much, a good example of rewarding moderation ([Vulcan Post](https://vulcanpost.com/563411/plant-nanny-app-drink-water-review/)).
- **Fish'n'Steps (research, 2006):** steps grew a fish in a shared tank. It raised activity, but users felt guilt when the fish looked sad, and **some avoided the app so they wouldn't see an unhappy avatar** ([arXiv review](https://arxiv.org/pdf/1509.05238)).
- **UbiFit Garden (research, 2008):** a phone-wallpaper garden where a different flower stands for each activity type (cardio, strength, flexibility, walking) and butterflies mark goals reached. Over a 3-month trial, participants with the display kept their activity steady through the winter holidays, while those without it dropped significantly ([Consolvo](https://www.consolvo.org/ubifit)).

### Ring Fit Adventure

- Turn-based RPG battles where the attacks are exercise reps, and each properly performed rep adds damage. A fitness test sets the difficulty, and break prompts adapt as your stamina improves. The flaw: at high levels, enemies die before the routine finishes, which **cuts the workout short** ([CGM review](https://www.cgmagonline.com/reviews/ring-fit-adventure-switch-review)). **Lesson: game power must never reduce the actual training.**

### Walkr and Streaks (briefly)

- **Walkr:** steps become fuel for a spaceship exploring 100+ planets ([App Store](https://apps.apple.com/app/id834805518)).
- **Streaks:** up to 24 habits, Health-linked auto-completion, and a "2-Day Rule" for negative habits. Users praise its clean design ([App Store](https://apps.apple.com/nl/app/streaks/id963034692?l=en-GB)).
- **Nike Run Club:** not researched; the searches returned no usable sources.

---

## 2. What the evidence says

### Solid, peer-reviewed evidence

| Topic | Finding | Source |
|---|---|---|
| Gamified physical activity | g = 0.42 overall; g = 0.23 vs active controls; +1,610 steps/day; g = 0.15 at about 14 weeks after the intervention ended. GRADE certainty is low for the overall effect and high for the active-control and follow-up findings. Median statistical power across studies was 63%. | [Mazeas et al. 2022](https://www.jmir.org/2022/1/E26779/) |
| Social gamification (STEP UP RCT, n = 602) | Points and levels with loss framing (70 points every Monday, minus 10 per missed day). All three social arms beat control, by +678 to +924 steps. After incentives stopped, only the competition arm stayed significantly above control. | [ACC summary](https://acc.org/latest-in-cardiology/articles/2019/11/26/08/23/key-takeaways-regarding-gamification-to-increase-physical-activity) |
| Novelty effect | The effect follows a U-shape: it declines after about 4 weeks, then partly recovers between weeks 6 and 10 as users get used to it (14 weeks, n = 756) | [Rodrigues et al. 2022](https://www.universityxp.com/research/2022/10/3/gamification-suffers-from-the-novelty-effect-but-benefits-from-the-familiarization-effect-findings-from-a-longitudinal-study) |
| Gamification overall | Mostly positive, but highly dependent on context and users, with novelty a caveat. The number of studies reviewed is **[unverified]**. | [Hamari et al. 2014 summary](https://gamification-research.org/2013/09/does-gamification-work-a-look-into-research/) |
| Overjustification | Across 128 studies, expected tangible rewards reduce free-choice intrinsic motivation (engagement-contingent d = −0.40, completion-contingent d = −0.36, performance-contingent d = −0.28). **Positive feedback improves it (d = +0.33). Unexpected rewards have no effect (d ≈ 0.01).** | [Deci, Koestner & Ryan 1999](https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf) |
| Habit formation | Median 66 days to automaticity (range 18–254). For exercise the median was 91 days, from only 13 people. **One missed day did not derail habit formation.** | [Lally et al. 2010, analysed](https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit) |
| Gym habit | New gym members (n = 111) needed at least 4 sessions a week for 6 weeks. Consistency, enjoyment and simplicity predicted habit. | [ODPHP on Kaushal & Rhodes 2015](https://odphp.health.gov/news-archive/blog/2015/04/what-does-it-take-to-make-a-fitness-habit/index.html) |
| Slack and reserves | Goals with built-in skips: up to 40% more goal attainment. People got back on track after 55% of misses with 2 skips a week, vs 37% on a hard goal. | [Sharif & Shu](https://anderson-review.ucla.edu/emergency-reserves/) |
| Broken streaks | Breaking a streak often leads people to abandon the activity. Messages dwelling on the failure don't help; offering a new goal does. | [CU Boulder](https://www.colorado.edu/business/news/2023/04/20/research-streaks-marketing-tech-barasch); [UDel](https://lerner.udel.edu/seeing-opportunity/lerner-professor-researches-how-streaks-motivate-us/) |

### Self-determination theory (SDT)

SDT says lasting motivation comes from autonomy, competence and relatedness. Deci et al. support the competence side: informational positive feedback raises intrinsic motivation, while controlling, expected rewards lower it ([Deci et al. 1999](https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf)). The exercise-specific review (Teixeira et al. 2012) reports that autonomous motivation predicts adherence. Its page was blocked, so the detailed claims are **[unverified]** ([PMC3441783](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3441783/)).

**Design implication:** the character should give feedback about competence ("that's your heaviest squat") rather than act as a wage. Goals should be self-set, so the target is your own plan, not the app's.

### Loss aversion and streak anxiety

Loss framing works in trials (STEP UP) and at scale (Duolingo). It also produces the guilt that users complain about: the Debugger article, Apple users before pauses existed, and Strava runners getting injured. Tracking itself can make an enjoyed activity feel like work, according to Etkin 2016 as cited by [The Decision Lab](https://thedecisionlab.com/es-ES/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification). The commonly quoted "losses hurt about 2× as much as gains" figure (Kahneman & Tversky) was not checked this session **[unverified]**.

### Variable rewards

The "slot machine" argument (Eyal's *Hooked*, Tristan Harris, Schüll's *Addiction by Design*) is mostly opinion and ethnography, not app RCTs ([SD Times opinion piece](https://sdtimes.com/addiction/ethics-addiction-and-dark-patterns/)). The meta-analytic finding that *unexpected* rewards don't undermine motivation ([Deci et al.](https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf)) supports **occasional surprise cosmetic drops**. Paid loot boxes or gambling-style odds are a different thing and should be avoided.

### Marketing claims to discount

- Duolingo's "3.6× more likely to finish" (correlational).
- The "+25% from Leagues" headline (no data given).
- Rive's "15× smaller files" (vendor-reported, [Rive blog](https://rive.app/blog/rive-as-a-lottie-alternative)).
- Walkr's awards and ratings (not outcomes).

---

## 3. Character and story design

### How Duolingo builds characters

- **Shape language:** simple geometry, big endearing eyes, a distinctive body shape and detached feet. These traits make the whole cast look like they belong to one world. The cast took about 18 months to develop. Each character has a unique animation that plays when you answer correctly, and runs of correct answers trigger "mid-lesson" reward animations ([Building character](https://blog.duolingo.com/building-character/)).
- **Rive state machines:** the characters are built in Rive, a real-time interactive animation tool, with state machines that engineers drive from code. Mouth states run at the same time as body states, each character has 20+ mouth shapes, idle behaviours include blinking, nodding and eyebrow movement, and there is a final state that reacts to right or wrong answers ([World character visemes](https://blog.duolingo.com/world-character-visemes)).
- **Lily, the video-call character:** 8 head and 8 body idle animations combine into more than 64 variations, so she never loops visibly. Reactions include leaning in, squinting and eye rolls. The team toned down over-wide eyes that "read as unnaturally happy". The file is under 1 MB ([Rive blog](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)).
- **Note on rigging:** Duolingo's posts above don't explicitly describe bone rigging. Rive does support bones, but that is **[unverified from Duolingo sources]**.

**For openGym:** the Rive web runtime is about 222 KB (canvas-lite) to 567 KB (canvas), brotli-compressed ([Rive runtime sizes](https://rive.app/docs/runtimes/runtime-sizes.md)). CONTRIBUTING.md treats any new frontend dependency as a "hard sell". A dependency-free alternative fits better: a layered inline SVG character (body, eyes, mouth, arms and accessory as separate groups) driven by CSS keyframes and a small JS state map (`idle | cheer | flex | sleepy | proud | concerned`). This is the same idea as a state machine, just hand-built.

### Expressions tied to behaviour (endearing, not nagging)

| Event | Character reaction | Avoid |
|---|---|---|
| Workout finished | Big celebration animation, shows the session's best lift | Celebrating volume beyond your plan |
| PR | Special "flex" animation and a badge | Unlimited PR spam |
| Rest day (planned) | Character rests, reads or goes on an off-screen adventure (as in Finch) and comes back with a story snippet | Rest shown as idleness |
| Missed planned session | Neutral; "Want to shift today's session to tomorrow?" | Crying, sad eyes, "you let me down" |
| 3+ days inactive | One gentle check-in, then silence (Duolingo stops reminders after a while too) | Escalating guilt notifications |
| Over calorie target | **No reaction at all** | Red, sad face or any comment |
| Protein hit | Small happy bounce | Comparing to other days |

Fish'n'Steps is the key warning: a sad avatar made some users *avoid the app* ([arXiv](https://arxiv.org/pdf/1509.05238)). Allow mood to dip at most to "sleepy" or "waiting", never sick, sad or dying, and **never let evolution go backwards**.

### Narrative arc ("from zero to hero")

- Map story beats to evolution stages, timed against the evidence: a first evolution inside 2–3 weeks (before novelty starts to decline at about 4 weeks), and a major one around weeks 9–13 (when habits typically become automatic, per Lally and Kaushal & Rhodes).
- Zombies, Run! shows story drives running, but the meta-game must feed back into the story or it feels hollow ([GeekDad](https://geekdad.com/2015/05/zombies-run/)).
- Deliver story as short chapter cards unlocked by levels. They can be written once (or drafted with the existing AI Coach) and stored as static JSON, so no server is needed.

### Humour versus sincerity

Duolingo keeps the unhinged humour for social media and makes Duo a "wholesome", encouraging coach in the product ([Campaign](https://campaignlive.com/article/duolingo-comms-head-sam-dalsimer-leads-wholesome-unhinged-strategy/1910699)). Do the same: puns and silliness on wins, sincerity on hard days. Guilt-humour reads as a joke at scale but as nagging in a personal app.

---

## 4. Rules for food and body

### Evidence of harm

- **Levinson et al. 2017:** surveyed 105 people with eating disorders. 74.3% used MyFitnessPal, and 73.1% of those said it contributed to their symptoms ([Duke Psychiatry summary](https://psychiatry.duke.edu/blog/trouble-tracking)).
- **Simpson & Mazzeo 2017:** among students, calorie tracking was linked to food anxiety and restrictive dieting. The study was a single survey, so it shows correlation, not causation ([Psychology in Action](https://www.psychologyinaction.org/2018-4-29-calorie-counting-and-fitness-tracking-technology-associations-with-eating-disorder-symptomology/)).
- **Causation and balance:** current evidence suggests apps mainly harm people who already have symptoms. An RCT of 200 low-risk women found no difference in mental health. Guilt from missed-goal and broken-streak messages and "good food / bad food" labels are flagged risks ([Center for Research](https://www.center4research.org/fitness-tracking-apps-eating-disorders/)).
- **Eikey 2021 (n = 24 women):** found eight harms:
  - fixation on numbers
  - rigid diet
  - obsession
  - app dependency
  - **a "high sense of achievement" from staying under budget, signalled in green**
  - **guilt and shame from red "over" visuals**
  - motivation from warning messages
  - **"excess competition" to beat the app or previous days**

  Recommendations include fewer reminders, rewarding non-logging engagement, softer visual feedback (a red flag looks the same whether 1 or 1,000 kcal over) and involving people with lived experience ([Eikey 2021](https://icdicd-11-for-mental-and-behavioural-disorders.readthedocs.io/projects/bjpsych-bull/2021/PMC8485346.xml.html)).
- **Other design guidance:** reduce red/green status colours, remove punitive or body-shaming gamification (Carrot FIT's avatar receiving electric shocks is the named example), and block extreme goals such as 500 kcal/day ([The Swaddle](https://www.theswaddle.com/health-tracking-apps-provide-a-worrying-pipeline-to-eating-disorders-better-tech-design-can-fix-that)).
- **Noom:** renamed its "red" foods to "orange" after backlash over stigmatising foods as bad ([Garage Gym Reviews](https://www.garagegymreviews.com/noom-review)).

### Proposed safe nutrition reward rules for openGym

1. **Reward the process, not the restriction.** XP for logging a day, for hitting protein (≥ 90% of target), and for being *within a range* of the calorie target. Never XP or praise for being further under.
2. **Use a range with a floor.** "In range" means between 90% and 110% of target. Below 90% earns nothing, and on a repeat the character offers one gentle line ("Fuel matters for lifting, want to check your target?"). This mirrors Plant Nanny's too-much-water warning ([Vulcan Post](https://vulcanpost.com/563411/plant-nanny-app-drink-water-review/)).
3. **No punishment for going over:** no red, no XP loss, no sad face, no streak break. Above 110% simply doesn't earn the range bonus.
4. **Weight never touches the character.** The character's look, mood and evolution come only from behaviour, never from body-weight readings. This matters for the potato in particular: it must **not** evolve by getting thinner. It evolves by gaining gear, skills and settings.
5. **No food labels:** no "good" or "bad" foods and no green/red per item.
6. **Cap the daily nutrition XP** so logging can't become the main game (see §5).
7. **Body-neutral mode:** one Settings toggle turns off all nutrition XP and hides weight from game screens. Default the suggested target-change prompts to neutral wording.
8. **Hard limits:** reuse or add a calorie-target floor in the suggestion engine. Never suggest targets below a safe minimum, and never gamify deficit size.
9. **Protein target:** keep the user-set target. As a reference, the ISSN position stand recommends about 1.4–2.0 g/kg/day for exercising people, possibly higher in a deficit ([JISSN 2017](https://doaj.org/article/fcc34534a75d466aa37abda0042df7a7)). **[unverified this session: fetch failed]**.

---

## 5. A reward economy that fits

### Principles

- Streaks are **weekly**, sessions are what count, and rest days count. openGym's `streakWeeks` already counts consecutive weeks with ≥ 1 workout (`frontend/src/lib/history.js:882`). Upgrade it to a "target week" (planned sessions met) and keep the current one as a softer "active weeks" stat.
- XP should be **derived, not stored**: a pure `gamify.js` in `src/lib` recomputes XP, level and badges from `S.workouts`, the food log and body-weight data, with a unit test beside it, as CONTRIBUTING requires. Deleting a fake log then removes its XP, and no new server code is needed.

### XP table (starting proposal)

| Source | XP | Rule |
|---|---|---|
| Strength session finished | **50** | ≥ 3 completed working sets |
| Run, cardio or calisthenics session | **30** | ≥ 15 min or a logged distance |
| PR (e1RM or rep PR from `onerm.js`) | **20** each | Max 3 PRs (60 XP) per session |
| Food day logged | **10** | ≥ 2 entries, or "day complete" ticked |
| Protein hit | **15** | ≥ 90% of target |
| Calories in range | **10** | 90–110% of target; never for under |
| Daily nutrition cap | **35** | — |
| Weekly quest: training target met | **100** | e.g. 4 planned lifts (rest days don't matter) |
| Weekly quest: food logged 5 of 7 days | **40** | — |
| Weekly quest: protein 4 of 7 days | **40** | — |
| Rest day | 0 XP, but story or rest animation | Rest is content, not a gap |

A typical good week is 4 lifts (200) + 2 runs (60) + about 2 PRs (40) + 6 food days at about 30 (180) + quests (180), roughly **650 XP**. A strong week reaches about 800. Nutrition is capped near 40% of the total, so training stays the core.

### Level curve

XP to go from level *n* to *n*+1 = **200 + 50·n**, so the total to reach level L = 200(L−1) + 25·L(L−1).

| Level | Total XP | ≈ weeks at 650 XP/week | Suggested evolution |
|---|---|---|---|
| 5 | 1,300 | 2 | Stage 2: first visible change, before the novelty dip |
| 12 | 5,500 | 8–9 | Stage 3: around habit automaticity |
| 20 | 13,300 | about 20 | Stage 4 |
| 30 | 27,550 | about 42 | Stage 5, the "Super" form |
| 30+ | — | — | Prestige: cosmetic recolours and new story arcs; the stage stays |

Evolution never reverses.

### Streaks, freezes and rest

- **Target week:** completed sessions ≥ weekly target (default: planned routine days, minimum 1). Runs and calisthenics count toward it too.
- **Freezes:** you earn 1 for every 4 target weeks and can hold at most 2. This mirrors Duolingo's two-freeze cap and the "2 skips" reserve that worked best for Sharif & Shu. A freeze auto-applies to a missed week.
- **Pause:** for illness, travel or a planned deload break, with no time limit. It doesn't add to the streak and doesn't break it, as with Apple's ring pauses and Habitica's Pause Damage. The character shows "Zzz".
- **Deload weeks** count as target weeks when the planned sessions are done.
- **Broken streak:** no failure screen. Show "New chapter: start a 4-week run?", which offers a fresh goal as the research recommends.

### Badges (one-time, informational)

- First PR on each main lift
- Bodyweight-relative milestones, opt-in (e.g. bodyweight bench)
- 10, 50 and 100 sessions
- First 5K or 10K
- Calisthenics skills: first pull-up, 10 push-ups, L-sit
- 4, 12 and 26 target weeks
- 30 food-logged days

Never any badge for weight lost.

### Cosmetics and surprise

- Outfits, props and backgrounds unlocked by level.
- A small chance (about 1 in 5) of a surprise cosmetic after a finished workout. Unexpected rewards don't undermine motivation (Deci et al.). No currency to buy anything; the app is free and self-hosted.

### Keeping it honest (lightly)

Cheating only cheats yourself, so the checks only need to block accidents:

- **Daily caps:** nutrition 35 XP; at most 2 sessions a day count for XP.
- **No XP for imported history** (`DATA_IMPORTS`). Instead, give a one-time "veteran" level grant capped at level 5.
- **Backdated logs** older than 7 days count for stats but not XP.
- **PR XP** only for sets with ≥ 1 rep at ≥ 50% of the current e1RM. This stops farming tiny rep-range PRs.
- **Derived XP** means editing or deleting a log updates XP automatically.
- An optional honour-system line in Settings: "XP only means something if it's real."

---

## 6. Concept directions

**Baseline: the Couch Potato → Super Potato (refined).** Five stages:

1. Couch Potato: on the sofa, remote in hand
2. Sprout Spud: sneakers, first stretch
3. Gym Tater: headband, chalk
4. Hash Brown Hero: cape and barbell
5. Super Potato: glowing, on a mountain top

Keep the potato's **body shape constant** and show progress through gear, posture, setting and abilities. A slimmer potato would make fatness the enemy (§4). Humour is natural ("you're on a roll... a potato roll").
- **Suits:** the owner's own sense of humour.
- **Risks:** food-mascot overlap with the nutrition log (avoid jokes about eating potatoes), and self-deprecating jokes can sour on bad days.

**A. Hatchling companion (pet that grows).** An egg hatches into a small creature, such as a dragon or axolotl, that "trains alongside you". It evolves with your level, learns a move named after each lift you PR, and on rest days goes on short adventures and brings back a story or a cosmetic, as Finch does. It never dies, gets hungry or gets sick.
- **Suits:** people who respond to care and attachment; it's the most Duolingo- and Finch-like option.
- **Risks:** attachment makes any "sad" state powerful, so keep moods positive or neutral. Cute styling may not appeal to everyone.

**B. Pixel RPG hero.** A 16-bit hero whose stats map to real training: STR from lifting volume and PRs, END from runs, AGI from calisthenics skills, and VIT from protein and logging consistency. Each week is a "dungeon" with a boss that takes damage from completed sessions and is defeated by meeting the weekly target. Pause Damage is built in. It draws on Habitica and Ring Fit.
- **Suits:** gamers and min-maxers, and it fits an existing pixel-art style easily.
- **Risks:** stat obsession could push extra volume (the Strava problem), so cap XP per session. Habitica's punishment model must not be copied. Ring Fit's lesson: game power must never shorten workouts.

**C. Training garden.** A UbiFit-style garden on the Home screen. Strength sessions grow oaks, runs grow wildflowers, calisthenics grows climbing vines, food-logged days add soil richness, and weekly targets bring butterflies. Seasons change every 13 weeks. Missed weeks leave the garden **dormant (winter), never dead**.
- **Suits:** people who want calm, glanceable motivation. UbiFit is the only concept with field-trial evidence of sustained activity.
- **Risks:** less personality and humour, harder to make feel "Duolingo-like", and wilting imagery would recreate Fish'n'Steps guilt.

**D. Orbit: space expedition.** Each session is fuel and distance (in Walkr style). Levels unlock planets, each with a short log entry, and PRs discover moons. The story is a ship's log written by a laconic AI co-pilot, which the AI Coach could voice.
- **Suits:** sci-fi fans; it scales well, with an endless map and no body imagery at all, so it is the safest choice for nutrition.
- **Risks:** abstract, weaker emotional pull than a character, and it needs a lot of art for planets.

**E. No mascot: rings and badges.** Three weekly rings: **Train** (sessions vs target), **Move** (run and calisthenics minutes) and **Fuel** (food-logged and protein days). Add PR badges, a level number and pause support like Apple's.
- **Suits:** people who find mascots childish and want a serious, low-maintenance tool. It is cheapest to build and fits the dependency-light rule.
- **Risks:** least delight and weakest against the novelty dip, though it is also the least likely to cause guilt.

**Recommendation.** Ship option E's rings and XP engine first: it's a pure `src/lib` module with tests and all the concepts need it. Then add a character skin on top: the refined potato or option A. Use layered SVG for the character so no runtime dependency is needed.

---

## Sources

- Duolingo – How the streak builds habit: https://blog.duolingo.com/how-duolingo-streak-builds-habit
- Duolingo – Improving the streak: https://blog.duolingo.com/improving-the-streak
- Duolingo – Building character: https://blog.duolingo.com/building-character/
- Duolingo – World character visemes: https://blog.duolingo.com/world-character-visemes
- Duolingo – Hi, it's Duo (notification bandit): https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/
- Lenny's Newsletter – Behind the product: Duolingo streaks: https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- Deconstructor of Fun – Duolingo Leagues: https://duolingo.deconstructoroffun.com/mechanics/leagues
- Design Week – Duolingo owl makeover: https://www.designweek.co.uk/issues/2-6-january-2019/duolingo-owl-receives-makeover-as-app-becomes-more-gamified
- Debugger – Duolingo needs to chill: https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0
- Campaign – "Wholesome unhinged": https://campaignlive.com/article/duolingo-comms-head-sam-dalsimer-leads-wholesome-unhinged-strategy/1910699
- Daily Tar Heel – The day Duo died: https://1893.dailytarheel.com/the-day-duo-died-and-gen-z-went-crazy/
- Rive – Duolingo's Lily: https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- Rive – Lottie alternative: https://rive.app/blog/rive-as-a-lottie-alternative
- Rive – Runtime sizes: https://rive.app/docs/runtimes/runtime-sizes.md
- Headway – Finch review: https://makeheadway.com/blog/finch-app-review/
- Pratt IXD – Finch critique: https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/
- MetaFilter – Finch thread: https://metafilter.com/207203/Habit-forming-for-good-with-Finch
- Screenwise – Finch: https://screenwiseapp.com/media/finch-app
- Habitica wiki – Death: https://habitica.fandom.com/wiki/Death
- Habitica wiki – Rest in the Inn: https://habitica.fandom.com/wiki/Rest_in_the_Inn
- MakerStack – Habitica review: https://makerstack.co/reviews/habitica-review/
- Pokémon GO – Adventure Sync: https://pokemongo.com/news/adventure-sync
- Serebii – Pokémon Sleep preview: https://serebii.net/pokemonsleep/preview/
- Smithsonian – Pokémon GO health study: https://www.smithsonianmag.com/smart-news/pokemon-go-craze-had-health-benefits-little-while-180961486/
- GeekDad – Zombies, Run!: https://geekdad.com/2015/05/zombies-run/
- BGR – watchOS 11 ring pause: https://bgr.com/tech/with-watchos-11-pausing-my-activity-rings-wont-make-me-feel-bad-about-myself-anymore/
- Fatherly – The Strava strain: https://www.fatherly.com/health/the-strava-strain
- Wikipedia – Forest: https://en.wikipedia.org/wiki/Forest_(application)
- Vulcan Post – Plant Nanny: https://vulcanpost.com/563411/plant-nanny-app-drink-water-review/
- CGM – Ring Fit Adventure review: https://www.cgmagonline.com/reviews/ring-fit-adventure-switch-review
- App Store – Walkr: https://apps.apple.com/app/id834805518
- App Store – Streaks: https://apps.apple.com/nl/app/streaks/id963034692?l=en-GB
- Consolvo – UbiFit Garden: https://www.consolvo.org/ubifit
- arXiv 1509.05238 – Wearable computing review (Fish'n'Steps, UbiFit): https://arxiv.org/pdf/1509.05238
- Mazeas et al. 2022, JMIR: https://www.jmir.org/2022/1/E26779/
- ACC – STEP UP trial: https://acc.org/latest-in-cardiology/articles/2019/11/26/08/23/key-takeaways-regarding-gamification-to-increase-physical-activity
- Rodrigues et al. 2022 – Novelty effect: https://www.universityxp.com/research/2022/10/3/gamification-suffers-from-the-novelty-effect-but-benefits-from-the-familiarization-effect-findings-from-a-longitudinal-study
- Hamari et al. 2014 summary: https://gamification-research.org/2013/09/does-gamification-work-a-look-into-research/
- Deci, Koestner & Ryan 1999: https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf
- Teixeira et al. 2012 (blocked, unverified): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3441783/
- The Behavioral Scientist – Lally 2010: https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit
- ODPHP – Gym habit (Kaushal & Rhodes): https://odphp.health.gov/news-archive/blog/2015/04/what-does-it-take-to-make-a-fitness-habit/index.html
- UCLA Anderson Review – Emergency reserves: https://anderson-review.ucla.edu/emergency-reserves/
- CU Boulder – Broken streaks: https://www.colorado.edu/business/news/2023/04/20/research-streaks-marketing-tech-barasch
- University of Delaware – Streak research: https://lerner.udel.edu/seeing-opportunity/lerner-professor-researches-how-streaks-motivate-us/
- The Decision Lab – Streak creep: https://thedecisionlab.com/es-ES/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification
- SD Times – Ethics, addiction and dark patterns: https://sdtimes.com/addiction/ethics-addiction-and-dark-patterns/
- Eikey 2021, BJPsych Bulletin (mirror): https://icdicd-11-for-mental-and-behavioural-disorders.readthedocs.io/projects/bjpsych-bull/2021/PMC8485346.xml.html
- Duke Psychiatry – The trouble with tracking: https://psychiatry.duke.edu/blog/trouble-tracking
- Psychology in Action – Simpson & Mazzeo: https://www.psychologyinaction.org/2018-4-29-calorie-counting-and-fitness-tracking-technology-associations-with-eating-disorder-symptomology/
- Center for Research – Fitness apps and eating disorders: https://www.center4research.org/fitness-tracking-apps-eating-disorders/
- The Swaddle – Health tracking apps and eating disorders: https://www.theswaddle.com/health-tracking-apps-provide-a-worrying-pipeline-to-eating-disorders-better-tech-design-can-fix-that
- Garage Gym Reviews – Noom: https://www.garagegymreviews.com/noom-review
- ISSN protein position stand (fetch failed, unverified): https://doaj.org/article/fcc34534a75d466aa37abda0042df7a7

### Not verified this session
- Hamari 2014 study count
- Teixeira 2012 SDT details
- Loss-aversion coefficient (~2×)
- Duolingo freeze gem price and XP per lesson
- Nike Run Club mechanics
- Bone rigging in Duo specifically
- ISSN protein range (from background knowledge)
- Fish'n'Steps and UbiFit sample sizes (not in the review fetched)
