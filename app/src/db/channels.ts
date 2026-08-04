import type { InferInsertModel } from 'drizzle-orm'
import type { channels } from './schema'

type ChannelSeed = InferInsertModel<typeof channels>

/**
 * The researched catalog of every venue worth posting to.
 *
 * `postingRules` is fed verbatim to the LLM, so it is written as instructions
 * to a copywriter, not as documentation. Getting these right is most of what
 * makes generated copy land instead of getting removed by a moderator.
 *
 * Every venue here is posted by hand: the dashboard's job is to hand you
 * finished copy and the exact form to paste it into. `submitUrlTemplate`
 * supports {url}, {title} and {text} placeholders.
 */
export const CHANNEL_SEED: ChannelSeed[] = [
  // -------------------------------------------------------------------------
  // Social — auto
  // -------------------------------------------------------------------------
  {
    id: 'bluesky',
    cooldownDays: 0,
    metricsSource: 'bluesky',
    submitUrlTemplate: 'https://bsky.app/intent/compose?text={text}',
    name: 'Bluesky',
    category: 'social',
    homepageUrl: 'https://bsky.app',
    charLimit: 300,
    linkPolicy: 'fine',
    audience: 'Developers, indie makers, tech-adjacent early adopters.',
    postingRules:
      'Hard limit 300 characters — this is graphemes, not bytes, and the post is rejected if you exceed it. Links are not penalized and do not consume extra characters beyond their literal length. Conversational and understated works better than hype. No hashtag culture; one or two at most, or none. A thread works: lead post hooks, follow-up posts add detail.',
    bestTime: 'Weekday mornings US Eastern.',
    sortOrder: 10,
  },
  {
    id: 'mastodon',
    cooldownDays: 0,
    submitUrlTemplate: 'https://mastodon.social/share?text={text}',
    name: 'Mastodon',
    category: 'social',
    homepageUrl: 'https://joinmastodon.org',
    charLimit: 500,
    linkPolicy: 'fine',
    audience: 'FOSS-leaning developers, privacy and self-hosting crowd.',
    postingRules:
      'Limit 500 characters on most instances. This audience is allergic to marketing voice and warm to open-source, self-hosting, and privacy angles. Lead with what the thing does technically. Always include alt text for images. Content warnings are cultural — not needed for a project launch. Hashtags actually work here for discovery, unlike Bluesky: use two or three specific ones.',
    bestTime: 'Weekday mornings European or US Eastern.',
    sortOrder: 20,
  },
  {
    id: 'x',
    cooldownDays: 0,
    submitUrlTemplate: 'https://x.com/intent/post?text={text}',
    name: 'X / Twitter',
    category: 'social',
    homepageUrl: 'https://x.com',
    charLimit: 280,
    linkPolicy: 'first_comment',
    audience: 'Broad tech, build-in-public founders, AI community.',
    postingRules:
      'Limit 280 characters on a free account. The algorithm suppresses reach on posts containing an external link, so put the link in a reply rather than the main post and say "link below". A screenshot or short screen recording roughly doubles engagement. Open with a concrete result or a specific detail, never "excited to announce". Threads work well: hook, then build, link last.',
    bestTime: 'Tue-Thu, 9-11am US Eastern.',
    sortOrder: 30,
  },
  {
    id: 'linkedin',
    cooldownDays: 3,
    submitUrlTemplate: 'https://www.linkedin.com/feed/?shareActive=true',
    name: 'LinkedIn',
    category: 'social',
    homepageUrl: 'https://linkedin.com',
    charLimit: 3000,
    linkPolicy: 'first_comment',
    audience: 'Professional network, recruiters, B2B, less technical.',
    postingRules:
      'External links in the post body suppress reach — put the link in the first comment and reference it. First two lines are the only thing shown before "see more", so they carry the whole post. Short paragraphs with line breaks, not walls of text. A personal framing ("I spent three weekends on this because…") consistently outperforms a product announcement. Less technical audience than the rest of this list: explain what it does in plain language before naming the stack.',
    bestTime: 'Tue-Thu, 8-10am US Eastern.',
    sortOrder: 40,
  },
  {
    id: 'instagram',
    cooldownDays: 2,
    submitUrlTemplate: 'https://www.instagram.com/',
    name: 'Instagram',
    category: 'social',
    homepageUrl: 'https://instagram.com',
    charLimit: 2200,
    requiresImage: true,
    linkPolicy: 'not_clickable',
    audience: 'General consumer, design-led discovery.',
    postingRules:
      'An image or video is mandatory — there is no text-only post. Links in captions are not clickable at all, so drive to the bio link. Reels need 9:16 aspect and 5-90 seconds to reach the Reels tab. Caption should open with a hook in the first line since the rest is truncated. Hashtags still function for discovery here; five to ten specific ones. Visual-first: if the project has no compelling visual, this channel is a poor fit and should be marked optional.',
    bestTime: 'Weekday evenings.',
    sortOrder: 50,
  },

  // -------------------------------------------------------------------------
  // Launch platforms
  // -------------------------------------------------------------------------
  {
    id: 'producthunt',
    cooldownDays: 180,
    name: 'Product Hunt',
    category: 'launch_platform',
    submitUrlTemplate: 'https://www.producthunt.com/posts/new?url={url}',
    homepageUrl: 'https://www.producthunt.com',
    charLimit: 260,
    titleCharLimit: 60,
    requiresImage: true,
    linkPolicy: 'fine',
    audience: 'Early adopters, makers, tech press scouts.',
    postingRules:
      'Tagline is capped at 60 characters and does most of the work — it must say what the thing does, not be clever. Needs a gallery: at least three images at 1270x760, ideally a short demo video. Launch at 12:01am Pacific on a Tuesday, Wednesday or Thursday to get a full day on the leaderboard. Write a maker comment explaining why you built it — that comment drives more conversion than the listing itself. Do not automate this: PH bans automated submissions, and a launch needs a real maker account plus hunter etiquette.',
    bestTime: 'Tue-Thu 12:01am US Pacific.',
    sortOrder: 60,
  },
  {
    id: 'hackernews',
    cooldownDays: 21,
    metricsSource: 'hackernews',
    name: 'Hacker News (Show HN)',
    category: 'launch_platform',
    submitUrlTemplate: 'https://news.ycombinator.com/submitlink?u={url}&t={title}',
    homepageUrl: 'https://news.ycombinator.com',
    charLimit: null,
    titleCharLimit: 80,
    linkPolicy: 'fine',
    audience: 'Senior engineers, deeply allergic to marketing.',
    postingRules:
      'Title format is exactly "Show HN: <thing> - <plain one-line description>" and is capped at 80 characters. Zero marketing voice — no "revolutionary", no "game-changing", no emoji. State plainly what it is and what it does. Add a first comment covering why you built it, the technical approach, what is genuinely hard about it, and what does not work yet. Admitting limitations up front earns enormous goodwill here. Submit Tuesday-Thursday, 8-10am US Eastern. There is no write API and automating submissions violates site guidelines, so this is always a manual click.',
    bestTime: 'Tue-Thu 8-10am US Eastern.',
    sortOrder: 70,
  },
  {
    id: 'peerlist',
    cooldownDays: 90,
    name: 'Peerlist Launchpad',
    category: 'launch_platform',
    submitUrlTemplate: 'https://peerlist.io/launchpad',
    homepageUrl: 'https://peerlist.io/launchpad',
    linkPolicy: 'fine',
    audience: 'Engineers and designers — the most technical launch audience available.',
    postingRules:
      'Weekly voting window with a deliberate cap on how many projects go live, so competition is lower than Product Hunt and a good project gets a fair shot. The audience is builders, which makes this the highest-quality traffic for a dev tool, API, or design resource. Lead with the technical substance and the problem it solves for someone who builds things.',
    bestTime: 'Start of the weekly voting window.',
    sortOrder: 80,
  },
  {
    id: 'uneed',
    cooldownDays: 180,
    name: 'Uneed',
    category: 'launch_platform',
    submitUrlTemplate: 'https://www.uneed.best/submit-a-tool',
    homepageUrl: 'https://www.uneed.best',
    linkPolicy: 'fine',
    audience: 'Indie maker audience, curated daily launches.',
    postingRules:
      'Curated rather than purely vote-ranked — the team selects, so a genuinely good product beats one with a big upvote network. Smaller and friendlier than Product Hunt. Keep the description concrete and specific.',
    bestTime: 'Any weekday.',
    sortOrder: 90,
  },
  {
    id: 'betalist',
    cooldownDays: 365,
    name: 'BetaList',
    category: 'launch_platform',
    submitUrlTemplate: 'https://betalist.com/submit',
    homepageUrl: 'https://betalist.com',
    linkPolicy: 'fine',
    audience: 'Early adopters who specifically seek out pre-launch products.',
    postingRules:
      'Built for products still in beta or pre-launch, so it is the right venue for building a waitlist before a real launch rather than after one. Frame the copy around what is coming and why someone should get early access, not around a finished product.',
    bestTime: 'Before a full public launch.',
    sortOrder: 100,
  },
  {
    id: 'startupbase',
    cooldownDays: 180,
    name: 'StartupBase',
    category: 'launch_platform',
    submitUrlTemplate: 'https://startupbase.io/submit',
    homepageUrl: 'https://startupbase.io',
    linkPolicy: 'fine',
    audience: 'Indie makers and early adopters.',
    postingRules:
      'Every approved product gets a real launch slot and stays discoverable afterward through product pages, rankings, collections and the newsletter — so the value is a long tail rather than a single spike day.',
    bestTime: 'Any weekday.',
    sortOrder: 110,
  },
  {
    id: 'fazier',
    cooldownDays: 180,
    name: 'Fazier',
    category: 'launch_platform',
    submitUrlTemplate: 'https://fazier.com/submit',
    homepageUrl: 'https://fazier.com',
    linkPolicy: 'fine',
    audience: 'Indie makers, startup launch audience.',
    postingRules: 'Straightforward launch directory. Concrete tagline, clear screenshot.',
    bestTime: 'Any weekday.',
    sortOrder: 120,
  },

  // -------------------------------------------------------------------------
  // Directories
  // -------------------------------------------------------------------------
  {
    id: 'saashub',
    cooldownDays: 365,
    name: 'SaaSHub',
    category: 'directory',
    submitUrlTemplate: 'https://www.saashub.com/submit',
    homepageUrl: 'https://www.saashub.com',
    linkPolicy: 'fine',
    audience: 'People comparison-shopping software.',
    postingRules:
      'A comparison and alternatives directory, so the copy should position against named competitors rather than describe features in isolation. Long-tail SEO value.',
    sortOrder: 130,
  },
  {
    id: 'alternativeto',
    cooldownDays: 365,
    name: 'AlternativeTo',
    category: 'directory',
    submitUrlTemplate: 'https://alternativeto.net/manage-item/?new=1',
    homepageUrl: 'https://alternativeto.net',
    linkPolicy: 'fine',
    audience: 'People actively looking to replace a tool they already use.',
    postingRules:
      'High-intent traffic: everyone here is already trying to switch away from something. The listing must name the specific tools this is an alternative to. Purely SEO long tail, no launch spike.',
    sortOrder: 140,
  },
  {
    id: 'theresanaiforthat',
    cooldownDays: 365,
    name: "There's An AI For That",
    category: 'directory',
    submitUrlTemplate: 'https://theresanaiforthat.com/submit/',
    homepageUrl: 'https://theresanaiforthat.com',
    linkPolicy: 'fine',
    audience: 'People searching for an AI tool for a specific job.',
    postingRules:
      'Only relevant if the project is genuinely AI-facing. Listings are organised by the task the AI performs, so lead with the job it does rather than the model or technique behind it.',
    requiresTags: ['ai'],
    sortOrder: 150,
  },
  {
    id: 'futurepedia',
    cooldownDays: 365,
    name: 'Futurepedia',
    category: 'directory',
    submitUrlTemplate: 'https://www.futurepedia.io/submit-tool',
    homepageUrl: 'https://www.futurepedia.io',
    linkPolicy: 'fine',
    audience: 'AI tool discovery audience.',
    postingRules:
      'AI tool directory. Only relevant for AI-facing projects. Categorised by use case; pick the narrowest accurate category.',
    requiresTags: ['ai'],
    sortOrder: 160,
  },

  // -------------------------------------------------------------------------
  // Reddit — each subreddit is its own channel because the rules differ
  // -------------------------------------------------------------------------
  {
    id: 'reddit:sideproject',
    cooldownDays: 30,
    metricsSource: 'reddit',
    name: 'r/SideProject',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/SideProject/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/SideProject/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'fine',
    audience: 'About 628k members. The most permissive place to share a project.',
    postingRules:
      'The friendliest large subreddit for showing a side project — direct sharing is the point of the sub, not a violation of it. Still, a post framed as "here is what I learned building this, here is the stack and what it costs to run" massively outperforms "check out my product". Include a screenshot. Answer every comment for the first few hours; the sub rewards presence.',
    bestTime: 'Tue-Thu mornings US Eastern.',
    sortOrder: 170,
  },
  {
    id: 'reddit:saas',
    cooldownDays: 30,
    metricsSource: 'reddit',
    name: 'r/SaaS',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/SaaS/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/SaaS/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'penalized',
    audience: 'About 200k members, SaaS founders.',
    postingRules:
      'Self-promotion is confined to the weekly promo thread — a standalone product post will be removed. Post to the weekly thread, or write a genuinely useful standalone post about a lesson learned where the product is incidental. Check the current stickied rules before posting; this sub enforces strictly.',
    bestTime: 'Whenever the weekly promo thread is live.',
    sortOrder: 180,
  },
  {
    id: 'reddit:indiehackers',
    cooldownDays: 21,
    metricsSource: 'reddit',
    name: 'r/indiehackers',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/indiehackers/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/indiehackers/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'penalized',
    audience: 'About 100k members, bootstrappers.',
    postingRules:
      'Journey and lessons posts substantially outperform product posts. Revenue numbers, real failure modes, and specific costs get engagement; polished announcements get ignored. Write it as a story with a concrete takeaway and let the product be the supporting detail rather than the subject.',
    bestTime: 'Weekday mornings US Eastern.',
    sortOrder: 190,
  },
  {
    id: 'reddit:vibecoding',
    cooldownDays: 14,
    metricsSource: 'reddit',
    name: 'r/vibecoding',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/vibecoding/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/vibecoding/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'fine',
    audience: 'Fast-growing community of AI-assisted builders.',
    postingRules:
      'The audience cares about the process as much as the product: which model and tooling you used, what the AI got wrong, how long it took, what you had to write by hand. Be specific about the workflow. Vague "built with AI" posts get no traction.',
    bestTime: 'Any weekday.',
    sortOrder: 200,
  },
  {
    id: 'reddit:buildinpublic',
    cooldownDays: 7,
    metricsSource: 'reddit',
    name: 'r/buildinpublic',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/buildinpublic/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/buildinpublic/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'fine',
    audience: 'About 30k members building in the open.',
    postingRules:
      'Progress updates are welcome by definition here — this is the right venue for incremental feature releases that would be too small for other subs. Share metrics, decisions and setbacks, not just wins.',
    bestTime: 'Any weekday.',
    sortOrder: 210,
  },
  {
    id: 'reddit:microsaas',
    cooldownDays: 30,
    metricsSource: 'reddit',
    name: 'r/microsaas',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/microsaas/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/microsaas/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'penalized',
    audience: 'About 50k members focused on small, profitable software.',
    postingRules:
      'Small-scale, revenue-focused audience. Concrete numbers — pricing, MRR, cost to run — are the currency. Only a good fit if the project is or could be commercial.',
    bestTime: 'Any weekday.',
    sortOrder: 220,
  },
  {
    id: 'reddit:claudeai',
    cooldownDays: 30,
    metricsSource: 'reddit',
    name: 'r/ClaudeAI',
    category: 'reddit',
    submitUrlTemplate: 'https://www.reddit.com/r/ClaudeAI/submit?title={title}&url={url}',
    homepageUrl: 'https://www.reddit.com/r/ClaudeAI/',
    charLimit: 40000,
    titleCharLimit: 300,
    linkPolicy: 'penalized',
    audience: 'Over 100k members, technical Claude users.',
    postingRules:
      'Only relevant if the project is built with or for Claude. Technical discussion is welcome, bare self-promotion is not — lead with the interesting technical detail of how you used the model, and mention the product second.',
    requiresTags: ['ai', 'claude'],
    bestTime: 'Any weekday.',
    sortOrder: 230,
  },

  // -------------------------------------------------------------------------
  // Dev content
  // -------------------------------------------------------------------------
  {
    id: 'devto',
    cooldownDays: 3,
    submitUrlTemplate: 'https://dev.to/new',
    name: 'DEV.to',
    category: 'dev_content',
    homepageUrl: 'https://dev.to',
    titleCharLimit: 250,
    linkPolicy: 'fine',
    audience: 'Working developers reading long-form technical content.',
    postingRules:
      'This is the long-form "how I built it" venue, not a place for a short announcement. Write a real article: the problem, the approach, code samples, what went wrong, what you would do differently. Markdown body with a front-matter style title and up to four tags. A post that teaches something ranks and keeps earning traffic; a product announcement sinks immediately.',
    bestTime: 'Tue-Thu mornings US Eastern.',
    sortOrder: 240,
  },
  {
    id: 'hashnode',
    cooldownDays: 3,
    name: 'Hashnode',
    category: 'dev_content',
    submitUrlTemplate: 'https://hashnode.com/create/story',
    homepageUrl: 'https://hashnode.com',
    linkPolicy: 'fine',
    audience: 'Developer blogging community.',
    postingRules:
      'Same long-form technical register as DEV.to. Cross-posting the same article is normal and accepted here — set the canonical URL to wherever it was published first.',
    sortOrder: 250,
  },
  {
    id: 'github-release',
    cooldownDays: 0,
    name: 'GitHub Release Notes',
    category: 'dev_content',
    submitUrlTemplate: '{repo}/releases/new',
    homepageUrl: 'https://github.com',
    linkPolicy: 'fine',
    audience: 'Existing users and anyone evaluating the repo.',
    postingRules:
      'Only applicable to an open-source project. Write real release notes: what changed, what broke, how to upgrade. Group by Added / Changed / Fixed. This doubles as the changelog everyone links to.',
    sortOrder: 260,
  },

  // -------------------------------------------------------------------------
  // Community
  // -------------------------------------------------------------------------
  {
    id: 'indiehackers',
    cooldownDays: 21,
    name: 'Indie Hackers',
    category: 'community',
    submitUrlTemplate: 'https://www.indiehackers.com/new-post',
    homepageUrl: 'https://www.indiehackers.com',
    linkPolicy: 'fine',
    audience: 'Bootstrapped founders.',
    postingRules:
      'Milestone and lesson posts are the native format. Revenue, user counts and honest post-mortems get read; launch announcements do not. Recent reporting suggests honest update posts here convert several times better than a Product Hunt launch for early users, so treat this as a primary channel rather than an afterthought.',
    bestTime: 'Weekday mornings US Eastern.',
    sortOrder: 270,
  },
  {
    id: 'discord',
    cooldownDays: 7,
    submitUrlTemplate: 'https://discord.com/channels/@me',
    name: 'Discord',
    category: 'community',
    homepageUrl: 'https://discord.com',
    charLimit: 2000,
    linkPolicy: 'fine',
    audience: 'Whichever server the webhook points at.',
    postingRules:
      'Posts through an incoming webhook, so it goes to one specific channel in one specific server. Limit 2000 characters. Keep it casual and short — Discord is a chat room, not a feed. Check that the server actually permits self-promotion in the target channel before scheduling anything recurring.',
    sortOrder: 280,
  },
  {
    id: 'telegram',
    cooldownDays: 1,
    submitUrlTemplate: 'https://web.telegram.org/',
    name: 'Telegram',
    category: 'community',
    homepageUrl: 'https://telegram.org',
    charLimit: 4096,
    linkPolicy: 'fine',
    audience: 'Whichever channel or group the bot posts to.',
    postingRules:
      'Posts via a bot to a channel or group you control. Limit 4096 characters. Supports basic HTML or Markdown formatting. Good for a personal broadcast channel of followers rather than cold discovery.',
    sortOrder: 290,
  },
]
