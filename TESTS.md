# Test Scenarios

## Sample Texts

### 1. Opinionated tech rant
Tests objectivity scale — lots of subjective language, hyperbole, slang.

> honestly the new MacBook Pro is absolutely INSANE like I'm not even kidding right now. the M4 chip destroys everything Intel has ever made and it's not even close lol. I've been using it for like 2 weeks and my old laptop feels like a literal brick now. battery life is genuinely ridiculous - I went the entire day without charging and still had like 40% left which is just unheard of. the screen is gorgeous obviously but what really blew my mind was the speakers?? like HOW does a laptop sound this good it makes zero sense. only complaint is the price tag is absolutely criminal honestly Apple is just robbing people at this point but whatever I guess you get what you pay for. if you're a developer or creative professional this is literally the best purchase you'll ever make no cap. the thermal management is chef's kiss too I was running Docker containers, had like 47 Chrome tabs open, Figma, VS Code, Slack, Spotify all at once and the thing barely got warm. my old ThinkPad would have literally caught fire. 10/10 would sell a kidney again

### 2. Rambling meeting notes
Tests verbosity scale — disorganized, redundant, lots of filler.

> so basically in today's meeting we talked about a bunch of stuff. first thing was the Q3 revenue numbers which Sarah presented and they were actually pretty good I think she said we hit $4.2M which is like 15% above target or something like that. the main driver was apparently the enterprise tier which grew 40% quarter over quarter because of those three big deals we closed - Acme Corp, GlobalTech, and I think the third one was Nexus Industries or something. anyway that was good news. then we moved on to the product roadmap and this is where things got kind of heated because the engineering team wants to do a complete rewrite of the authentication system which would take about 6 weeks and marketing is pushing hard for the new analytics dashboard because customers have been asking for it forever and sales says they're losing deals without it. so basically there's a resource conflict. Jake proposed we split the team but honestly I don't think that's a great idea because last time we did that both projects took twice as long and the quality suffered. Maria suggested we do auth first because it's a security thing and then dashboard right after. I think that makes the most sense personally. oh also we need to hire two more backend engineers apparently the job postings have been up for 3 weeks and we've only gotten like 12 applicants which is kind of concerning. HR is going to look into adjusting the salary range and maybe posting on different platforms. the budget for Q4 was also discussed briefly - we're looking at increasing the marketing spend by 25% to support the product launch and David wants to invest in a proper CI/CD pipeline which honestly we should have done ages ago. next meeting is Thursday at 2pm and Sarah is going to send the detailed revenue breakdown by email

### 3. Mixed Chinese/English emotional post
Tests language matching + objectivity.

> 今天跟我妈打电话真的气死了！！她又开始催婚了说什么"你看你表姐都生二胎了你还单着"。我真的受不了这种比较，每次过年回家都是这样，七大姑八大姨轮番轰炸。我现在月薪3万在上海过得挺好的，有自己的apartment，工作也是大厂的senior engineer，但在她眼里这些都不算什么，没结婚就是人生失败。我跟她说了无数次我现在focus on career development，等我ready了自然会考虑personal life的事情，但她根本听不进去。最让我崩溃的是她居然背着我给我报了一个相亲角！！就是那种公园里大爷大妈举着牌子的那种！！上面写着我的学历工资身高体重，我看到照片的时候literally想死。我知道她是为了我好but sometimes boundaries are important you know? 我已经30岁了不是小孩子了，我有权利decide my own life pace。真的好累，每次打完电话心情都要差好几天。

### 4. Dense technical explanation
Tests verbosity at extremes — can it summarize or expand technical content?

> The transformer architecture fundamentally relies on the self-attention mechanism which computes compatibility scores between all pairs of positions in a sequence. Specifically given input embeddings X the model projects them into queries Q=XW_Q keys K=XW_K and values V=XW_V then computes Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V where d_k is the key dimension. Multi-head attention extends this by running h parallel attention functions each with different learned projections then concatenating and projecting the results. The computational complexity is O(n^2 * d) where n is sequence length making it quadratic in context window size. This is why various efficient attention variants have been proposed including sparse attention which restricts the attention pattern to local windows plus global tokens, linear attention which uses kernel approximations to decompose the softmax into separate computations achieving O(n*d^2) complexity, and flash attention which doesn't change the mathematical operation but optimizes memory access patterns through tiling to reduce HBM reads/writes by orders of magnitude. Recent work on ring attention enables distributed computation across devices by splitting the sequence dimension and passing KV blocks in a ring topology allowing essentially unlimited context lengths bounded only by aggregate memory across the cluster.

---

## Slider Combinations

| Slider combo | Sample | Expected behavior |
|---|---|---|
| Verbosity 1, Objectivity 5 | #2 | Single sentence summary keeping original tone |
| Verbosity 7, Objectivity 5 | #4 | Expanded with background on why attention matters, what HBM is, etc. |
| Verbosity 5, Objectivity 1 | #1 | Facts only (M4 chip, battery stats, price), no "INSANE", "chef's kiss" |
| Verbosity 5, Objectivity 7 | #1 | Keeps "literally the best", "would sell a kidney", all caps |
| Verbosity 3, Objectivity 3 | #3 | Neutral bullet points, 3rd person: "the author describes frustration with..." |
| Verbosity 2, Objectivity 5 | #2 | 2-3 sentence TL;DR of the meeting |
| Verbosity 5, Objectivity 5 | #1 | Default behavior — clean Markdown, preserves voice (baseline) |
| Verbosity 7, Objectivity 1 | #3 | Comprehensive but objective — expanded context about cultural pressures, but no emotional language |
| Verbosity 1, Objectivity 7 | #1 | One sentence that still captures the raw enthusiasm and slang |
