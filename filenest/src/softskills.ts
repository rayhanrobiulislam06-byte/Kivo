import { EXTRA } from './extra'
import { MORE } from './more'
export type P = [string, string]
export type Lesson = { t: P; p: P[]; x: P; q: { q: P; o: P[]; a: number } }
export type Course = { t: P; i: string; l: Lesson[] }

export const COURSES: Course[] = [
  { t: ['Communication', 'যোগাযোগ'], i: '💬', l: [
    { t: ['Say it clearly', 'স্পষ্ট করে বলুন'],
      p: [['Start with the main point', 'আগে মূল কথাটি বলুন'], ['Use short, simple sentences', 'ছোট ও সহজ বাক্য ব্যবহার করুন'], ['Check that the other person understood', 'অপর পক্ষ বুঝেছে কি না যাচাই করুন']],
      x: ['Explain one idea to someone in three sentences today.', 'আজ একটি বিষয় কাউকে তিন বাক্যে বুঝিয়ে বলুন।'],
      q: { q: ['Which opening is clearest?', 'কোন শুরুটি সবচেয়ে স্পষ্ট?'], o: [['Well, so, basically…', 'মানে, আসলে, ধরুন…'], ['Main point: the report is two days late.', 'মূল কথা: রিপোর্ট দুই দিন দেরি হবে।'], ['I am not sure how to say this…', 'কীভাবে বলব বুঝতে পারছি না…']], a: 1 } },
    { t: ['Body language', 'শারীরিক ভাষা'],
      p: [['Keep an open, relaxed posture', 'খোলামেলা ও স্বাভাবিক ভঙ্গি রাখুন'], ['Make natural eye contact', 'স্বাভাবিকভাবে চোখে চোখ রাখুন'], ['Match your tone to your message', 'কথার সুর বার্তার সাথে মেলান']],
      x: ['In your next conversation, notice your posture and your face.', 'পরের কথোপকথনে নিজের বসার ভঙ্গি ও মুখের ভাব লক্ষ্য করুন।'],
      q: { q: ['Which posture shows you are open to listen?', 'কোন ভঙ্গি দেখায় আপনি শুনতে আগ্রহী?'], o: [['Looking away, arms crossed', 'অন্য দিকে তাকিয়ে হাত ভাঁজ করে'], ['Facing them, relaxed shoulders', 'তার দিকে ফিরে, শিথিল কাঁধে'], ['Checking your phone', 'ফোন দেখতে দেখতে']], a: 1 } },
  ] },
  { t: ['Active listening', 'মনোযোগ দিয়ে শোনা'], i: '👂', l: [
    { t: ['Listen to understand', 'বোঝার জন্য শুনুন'],
      p: [['Put distractions away', 'বিক্ষেপ সরিয়ে রাখুন'], ['Do not interrupt', 'কথার মাঝে থামাবেন না'], ['Let them finish before you reply', 'উত্তর দেওয়ার আগে তাকে শেষ করতে দিন']],
      x: ['In one chat today, listen fully without interrupting.', 'আজ একটি আলাপে না থামিয়ে পুরোটা শুনুন।'],
      q: { q: ['Best first response after someone finishes?', 'কেউ কথা শেষ করলে সবচেয়ে ভালো প্রথম প্রতিক্রিয়া কী?'], o: [['Give advice immediately', 'সঙ্গে সঙ্গে পরামর্শ দেওয়া'], ['Summarize what you heard', 'যা শুনেছেন তার সারাংশ বলা'], ['Change the topic', 'বিষয় বদলে ফেলা']], a: 1 } },
    { t: ['Ask good questions', 'ভালো প্রশ্ন করুন'],
      p: [['Open questions start with what or how', 'খোলা প্রশ্ন শুরু হয় কী বা কীভাবে দিয়ে'], ['Ask one question at a time', 'একবারে একটি প্রশ্ন করুন'], ['Follow up on their own words', 'তার বলা কথা ধরে প্রশ্ন করুন']],
      x: ['Ask three open questions in a conversation today.', 'আজ একটি আলাপে তিনটি খোলা প্রশ্ন করুন।'],
      q: { q: ['Which is an open question?', 'কোনটি খোলা প্রশ্ন?'], o: [['Did you like it?', 'আপনার কি ভালো লেগেছে?'], ['What did you like about it?', 'এর কোন অংশ ভালো লেগেছে?'], ['You liked it, right?', 'আপনার ভালো লেগেছে, তাই না?']], a: 1 } },
  ] },
  { t: ['Time management', 'সময় ব্যবস্থাপনা'], i: '⏰', l: [
    { t: ['Prioritize', 'অগ্রাধিকার ঠিক করুন'],
      p: [['Separate urgent from important', 'জরুরি আর গুরুত্বপূর্ণ আলাদা করুন'], ['Pick three key tasks each day', 'প্রতিদিন তিনটি মূল কাজ বেছে নিন'], ['Do the hardest task first', 'সবচেয়ে কঠিন কাজটি আগে করুন']],
      x: ['Write your top three tasks for tomorrow tonight.', 'আজ রাতে আগামীকালের তিনটি প্রধান কাজ লিখে রাখুন।'],
      q: { q: ['Important but not urgent tasks should be…', 'গুরুত্বপূর্ণ কিন্তু জরুরি নয় এমন কাজ…'], o: [['Ignored', 'এড়িয়ে যাওয়া উচিত'], ['Scheduled', 'সময় ঠিক করে রাখা উচিত'], ['Left to chance', 'ভাগ্যের উপর ছেড়ে দেওয়া উচিত']], a: 1 } },
    { t: ['Beat procrastination', 'ফেলে রাখার অভ্যাস কাটান'],
      p: [['Start with just five minutes', 'মাত্র পাঁচ মিনিট দিয়ে শুরু করুন'], ['Break big tasks into small steps', 'বড় কাজকে ছোট ধাপে ভাগ করুন'], ['Remove distractions first', 'আগে বিক্ষেপ সরান']],
      x: ['Pick a task you avoid and work on it for five minutes.', 'যে কাজ এড়াচ্ছেন সেটি পাঁচ মিনিট করুন।'],
      q: { q: ['Best way to start a big task?', 'বড় কাজ শুরুর সেরা উপায় কী?'], o: [['Wait for motivation', 'ইচ্ছা আসার অপেক্ষা করা'], ['Do the first small step', 'প্রথম ছোট ধাপটি করে ফেলা'], ['Check social media first', 'আগে সোশ্যাল মিডিয়া দেখা']], a: 1 } },
  ] },
  { t: ['Teamwork', 'দলগত কাজ'], i: '🤝', l: [
    { t: ['Clear roles', 'স্পষ্ট দায়িত্ব'],
      p: [['Define who does what', 'কে কী করবে তা ঠিক করুন'], ['Agree on deadlines', 'সময়সীমা নিয়ে একমত হন'], ['Share progress early', 'অগ্রগতি আগেভাগে জানান']],
      x: ['Write down roles and deadlines for your next group task.', 'পরের দলীয় কাজের দায়িত্ব ও সময়সীমা লিখে ফেলুন।'],
      q: { q: ['Why define roles?', 'দায়িত্ব ঠিক করা কেন দরকার?'], o: [['To avoid confusion and repeated work', 'বিভ্রান্তি ও একই কাজ দুবার করা এড়াতে'], ['To control others', 'অন্যদের নিয়ন্ত্রণ করতে'], ['To skip meetings', 'মিটিং এড়াতে']], a: 0 } },
    { t: ['Give feedback', 'ফিডব্যাক দিন'],
      p: [['Be specific', 'নির্দিষ্ট করে বলুন'], ['Talk about the work, not the person', 'কাজ নিয়ে বলুন, ব্যক্তি নিয়ে নয়'], ['Suggest a next step', 'পরবর্তী ধাপের পরামর্শ দিন']],
      x: ['Give one specific, kind piece of feedback today.', 'আজ একজনকে একটি নির্দিষ্ট ও ভদ্র ফিডব্যাক দিন।'],
      q: { q: ['Which feedback is best?', 'কোন ফিডব্যাকটি সবচেয়ে ভালো?'], o: [['You are bad at this.', 'তুমি এটায় খারাপ।'], ['The summary missed the budget; add it next time.', 'সারাংশে বাজেট বাদ গেছে; পরের বার যোগ করবেন।'], ['Whatever.', 'যা খুশি।']], a: 1 } },
  ] },
  { t: ['Emotional intelligence', 'আবেগীয় বুদ্ধিমত্তা'], i: '🧠', l: [
    { t: ['Know your feelings', 'নিজের অনুভূতি চিনুন'],
      p: [['Name the emotion you feel', 'কী অনুভব করছেন তার নাম দিন'], ['Notice what triggered it', 'কীসে তা শুরু হলো খেয়াল করুন'], ['Pause before you react', 'প্রতিক্রিয়া দেখানোর আগে থামুন']],
      x: ['Three times today, stop and name your feeling.', 'আজ তিনবার থেমে নিজের অনুভূতির নাম দিন।'],
      q: { q: ['First step when you feel angry?', 'রাগ হলে প্রথম ধাপ কী?'], o: [['React quickly', 'তাড়াতাড়ি প্রতিক্রিয়া দেখানো'], ['Pause and name the feeling', 'থেমে অনুভূতির নাম দেওয়া'], ['Blame someone', 'কাউকে দোষ দেওয়া']], a: 1 } },
    { t: ['Empathy', 'সহমর্মিতা'],
      p: [['Try to see their point of view', 'তার দৃষ্টিকোণ বোঝার চেষ্টা করুন'], ['Acknowledge their feelings', 'তার অনুভূতিকে স্বীকৃতি দিন'], ['Avoid saying just calm down', 'শুধু শান্ত হও বলা এড়ান']],
      x: ['Respond to someone today by first acknowledging how they feel.', 'আজ কাউকে উত্তর দেওয়ার আগে তার অনুভূতি স্বীকার করুন।'],
      q: { q: ['Which reply shows empathy?', 'কোন উত্তরে সহমর্মিতা ফোটে?'], o: [['It is not a big deal.', 'এটা তেমন কিছু না।'], ['That sounds really stressful.', 'শুনে মনে হচ্ছে খুব চাপের ছিল।'], ['Stop complaining.', 'অভিযোগ করা থামাও।']], a: 1 } },
  ] },
]
export const ALL: Course[] = [...COURSES, ...MORE].map((c, i) => ({ ...c, l: [...c.l, ...(EXTRA[i] || [])] }))
