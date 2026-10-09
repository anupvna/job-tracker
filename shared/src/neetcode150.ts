/*
 * The NeetCode 150 problem list, in NeetCode's roadmap topic order.
 *
 * Problem titles, topics, difficulty and video ids are taken from the open-source
 * neetcode-gh/leetcode repository (.problemSiteData.json):
 *
 *   MIT License — Copyright (c) 2022 neetcode-gh
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify, merge,
 *   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 *   to whom the Software is furnished to do so, subject to the following conditions: The above
 *   copyright notice and this permission notice shall be included in all copies or substantial
 *   portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * We only store titles and links; explanations and videos stay on NeetCode / LeetCode.
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export const NEETCODE_TOPICS = [
  "Arrays & Hashing",
  "Two Pointers",
  "Stack",
  "Binary Search",
  "Sliding Window",
  "Linked List",
  "Trees",
  "Tries",
  "Heap / Priority Queue",
  "Backtracking",
  "Intervals",
  "Greedy",
  "Graphs",
  "Advanced Graphs",
  "1-D Dynamic Programming",
  "2-D Dynamic Programming",
  "Bit Manipulation",
  "Math & Geometry"
] as const;
export type NeetcodeTopic = (typeof NEETCODE_TOPICS)[number];

export interface Problem {
  /** LeetCode slug, e.g. "two-sum". Stable id used in the database. */
  slug: string;
  title: string;
  difficulty: Difficulty;
  topic: NeetcodeTopic;
  /** YouTube id of NeetCode's walkthrough (may be empty). */
  video: string;
}

const DIFF = { E: 'Easy', M: 'Medium', H: 'Hard' } as const;

function p(slug: string, title: string, d: keyof typeof DIFF, topic: number, video: string): Problem {
  return { slug, title, difficulty: DIFF[d], topic: NEETCODE_TOPICS[topic]!, video };
}

/** All 150 problems in study order (topic by topic, NeetCode's order within each topic). */
export const NEETCODE_150: readonly Problem[] = [
  p("contains-duplicate", "Contains Duplicate", 'E', 0, "3OamzN90kPg"),
  p("valid-anagram", "Valid Anagram", 'E', 0, "9UtInBqnCgA"),
  p("two-sum", "Two Sum", 'E', 0, "KLlXCFG5TnA"),
  p("group-anagrams", "Group Anagrams", 'M', 0, "vzdNOK2oB2E"),
  p("top-k-frequent-elements", "Top K Frequent Elements", 'M', 0, "YPTqKIgVk-k"),
  p("product-of-array-except-self", "Product of Array Except Self", 'M', 0, "bNvIQI2wAjk"),
  p("valid-sudoku", "Valid Sudoku", 'M', 0, "TjFXEUCMqI8"),
  p("encode-and-decode-strings", "Encode and Decode Strings", 'M', 0, "B1k_sxOSgv8"),
  p("longest-consecutive-sequence", "Longest Consecutive Sequence", 'M', 0, "P6RZZMu_maU"),
  p("valid-palindrome", "Valid Palindrome", 'E', 1, "jJXJ16kPFWg"),
  p("two-sum-ii-input-array-is-sorted", "Two Sum II Input Array Is Sorted", 'M', 1, "cQ1Oz4ckceM"),
  p("3sum", "3Sum", 'M', 1, "jzZsG8n2R9A"),
  p("container-with-most-water", "Container With Most Water", 'M', 1, "UuiTKBwPgAo"),
  p("trapping-rain-water", "Trapping Rain Water", 'H', 1, "ZI2z5pq0TqA"),
  p("valid-parentheses", "Valid Parentheses", 'E', 2, "WTzjTskDFMg"),
  p("min-stack", "Min Stack", 'M', 2, "qkLl7nAwDPo"),
  p("evaluate-reverse-polish-notation", "Evaluate Reverse Polish Notation", 'M', 2, "iu0082c4HDE"),
  p("generate-parentheses", "Generate Parentheses", 'M', 2, "s9fokUqJ76A"),
  p("daily-temperatures", "Daily Temperatures", 'M', 2, "cTBiBSnjO3c"),
  p("car-fleet", "Car Fleet", 'M', 2, "Pr6T-3yB9RM"),
  p("largest-rectangle-in-histogram", "Largest Rectangle In Histogram", 'H', 2, "zx5Sw9130L0"),
  p("binary-search", "Binary Search", 'E', 3, "s4DPM8ct1pI"),
  p("search-a-2d-matrix", "Search a 2D Matrix", 'M', 3, "Ber2pi2C0j0"),
  p("koko-eating-bananas", "Koko Eating Bananas", 'M', 3, "U2SozAs9RzA"),
  p("find-minimum-in-rotated-sorted-array", "Find Minimum In Rotated Sorted Array", 'M', 3, "nIVW4P8b1VA"),
  p("search-in-rotated-sorted-array", "Search In Rotated Sorted Array", 'M', 3, "U8XENwh8Oy8"),
  p("time-based-key-value-store", "Time Based Key Value Store", 'M', 3, "fu2cD_6E8Hw"),
  p("median-of-two-sorted-arrays", "Median of Two Sorted Arrays", 'H', 3, "q6IEA26hvXc"),
  p("best-time-to-buy-and-sell-stock", "Best Time to Buy And Sell Stock", 'E', 4, "1pkOgXD63yU"),
  p("longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters", 'M', 4, "wiGpQwVHdE0"),
  p("longest-repeating-character-replacement", "Longest Repeating Character Replacement", 'M', 4, "gqXU1UyA8pk"),
  p("permutation-in-string", "Permutation In String", 'M', 4, "UbyhOgBN834"),
  p("minimum-window-substring", "Minimum Window Substring", 'H', 4, "jSto0O4AJbM"),
  p("sliding-window-maximum", "Sliding Window Maximum", 'H', 4, "DfljaUwZsOk"),
  p("reverse-linked-list", "Reverse Linked List", 'E', 5, "G0_I-ZF0S38"),
  p("merge-two-sorted-lists", "Merge Two Sorted Lists", 'E', 5, "XIdigk956u0"),
  p("reorder-list", "Reorder List", 'M', 5, "S5bfdUTrKLM"),
  p("remove-nth-node-from-end-of-list", "Remove Nth Node From End of List", 'M', 5, "XVuQxVej6y8"),
  p("copy-list-with-random-pointer", "Copy List With Random Pointer", 'M', 5, "5Y2EiZST97Y"),
  p("add-two-numbers", "Add Two Numbers", 'M', 5, "wgFPrzTjm7s"),
  p("linked-list-cycle", "Linked List Cycle", 'E', 5, "gBTe7lFR3vc"),
  p("find-the-duplicate-number", "Find The Duplicate Number", 'M', 5, "wjYnzkAhcNk"),
  p("lru-cache", "LRU Cache", 'M', 5, "7ABFKPK2hD4"),
  p("merge-k-sorted-lists", "Merge K Sorted Lists", 'H', 5, "q5a5OiGbT6Q"),
  p("reverse-nodes-in-k-group", "Reverse Nodes In K Group", 'H', 5, "1UOPsfP85V4"),
  p("invert-binary-tree", "Invert Binary Tree", 'E', 6, "OnSn2XEQ4MY"),
  p("maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", 'E', 6, "hTM3phVI6YQ"),
  p("diameter-of-binary-tree", "Diameter of Binary Tree", 'E', 6, "bkxqA8Rfv04"),
  p("balanced-binary-tree", "Balanced Binary Tree", 'E', 6, "QfJsau0ItOY"),
  p("same-tree", "Same Tree", 'E', 6, "vRbbcKXCxOw"),
  p("subtree-of-another-tree", "Subtree of Another Tree", 'E', 6, "E36O5SWp-LE"),
  p("lowest-common-ancestor-of-a-binary-search-tree", "Lowest Common Ancestor of a Binary Search Tree", 'M', 6, "gs2LMfuOR9k"),
  p("binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", 'M', 6, "6ZnyEApgFYg"),
  p("binary-tree-right-side-view", "Binary Tree Right Side View", 'M', 6, "d4zLyf32e3I"),
  p("count-good-nodes-in-binary-tree", "Count Good Nodes In Binary Tree", 'M', 6, "7cp5imvDzl4"),
  p("validate-binary-search-tree", "Validate Binary Search Tree", 'M', 6, "s6ATEkipzow"),
  p("kth-smallest-element-in-a-bst", "Kth Smallest Element In a Bst", 'M', 6, "5LUXSvjmGCw"),
  p("construct-binary-tree-from-preorder-and-inorder-traversal", "Construct Binary Tree From Preorder And Inorder Traversal", 'M', 6, "ihj4IQGZ2zc"),
  p("binary-tree-maximum-path-sum", "Binary Tree Maximum Path Sum", 'H', 6, "Hr5cWUld4vU"),
  p("serialize-and-deserialize-binary-tree", "Serialize And Deserialize Binary Tree", 'H', 6, "u4JAi2JJhI8"),
  p("implement-trie-prefix-tree", "Implement Trie Prefix Tree", 'M', 7, "oobqoCJlHA0"),
  p("design-add-and-search-words-data-structure", "Design Add And Search Words Data Structure", 'M', 7, "BTf05gs_8iU"),
  p("word-search-ii", "Word Search II", 'H', 7, "asbcE9mZz_U"),
  p("kth-largest-element-in-a-stream", "Kth Largest Element In a Stream", 'E', 8, "hOjcdrqMoQ8"),
  p("last-stone-weight", "Last Stone Weight", 'E', 8, "B-QCq79-Vfw"),
  p("k-closest-points-to-origin", "K Closest Points to Origin", 'M', 8, "rI2EBUEMfTk"),
  p("kth-largest-element-in-an-array", "Kth Largest Element In An Array", 'M', 8, "XEmy13g1Qxc"),
  p("task-scheduler", "Task Scheduler", 'M', 8, "s8p8ukTyA2I"),
  p("design-twitter", "Design Twitter", 'M', 8, "pNichitDD2E"),
  p("find-median-from-data-stream", "Find Median From Data Stream", 'H', 8, "itmhHWaHupI"),
  p("subsets", "Subsets", 'M', 9, "REOH22Xwdkk"),
  p("combination-sum", "Combination Sum", 'M', 9, "GBKI9VSKdGg"),
  p("permutations", "Permutations", 'M', 9, "s7AvT7cGdSo"),
  p("subsets-ii", "Subsets II", 'M', 9, "Vn2v6ajA7U0"),
  p("combination-sum-ii", "Combination Sum II", 'M', 9, "rSA3t6BDDwg"),
  p("word-search", "Word Search", 'M', 9, "pfiQ_PS1g8E"),
  p("palindrome-partitioning", "Palindrome Partitioning", 'M', 9, "3jvWodd7ht0"),
  p("letter-combinations-of-a-phone-number", "Letter Combinations of a Phone Number", 'M', 9, "0snEunUacZY"),
  p("n-queens", "N Queens", 'H', 9, "Ph95IHmRp5M"),
  p("insert-interval", "Insert Interval", 'M', 10, "A8NUOmlwOlM"),
  p("merge-intervals", "Merge Intervals", 'M', 10, "44H3cEC2fFM"),
  p("non-overlapping-intervals", "Non Overlapping Intervals", 'M', 10, "nONCGxWoUfM"),
  p("meeting-rooms", "Meeting Rooms", 'E', 10, "PaJxqZVPhbg"),
  p("meeting-rooms-ii", "Meeting Rooms II", 'M', 10, "FdzJmTCVyJU"),
  p("minimum-interval-to-include-each-query", "Minimum Interval to Include Each Query", 'H', 10, "5hQ5WWW5awQ"),
  p("maximum-subarray", "Maximum Subarray", 'M', 11, "5WZl3MMT0Eg"),
  p("jump-game", "Jump Game", 'M', 11, "Yan0cv2cLy8"),
  p("jump-game-ii", "Jump Game II", 'M', 11, "dJ7sWiOoK7g"),
  p("gas-station", "Gas Station", 'M', 11, "lJwbPZGo05A"),
  p("hand-of-straights", "Hand of Straights", 'M', 11, "amnrMCVd2YI"),
  p("merge-triplets-to-form-target-triplet", "Merge Triplets to Form Target Triplet", 'M', 11, "kShkQLQZ9K4"),
  p("partition-labels", "Partition Labels", 'M', 11, "B7m8UmZE-vw"),
  p("valid-parenthesis-string", "Valid Parenthesis String", 'M', 11, "QhPdNS143Qg"),
  p("number-of-islands", "Number of Islands", 'M', 12, "pV2kpPD66nE"),
  p("clone-graph", "Clone Graph", 'M', 12, "mQeF6bN8hMk"),
  p("max-area-of-island", "Max Area of Island", 'M', 12, "iJGr1OtmH0c"),
  p("pacific-atlantic-water-flow", "Pacific Atlantic Water Flow", 'M', 12, "s-VkcjHqkGI"),
  p("surrounded-regions", "Surrounded Regions", 'M', 12, "9z2BunfoZ5Y"),
  p("rotting-oranges", "Rotting Oranges", 'M', 12, "y704fEOx0s0"),
  p("walls-and-gates", "Walls And Gates", 'M', 12, "e69C6xhiSQE"),
  p("course-schedule", "Course Schedule", 'M', 12, "EgI5nU9etnU"),
  p("course-schedule-ii", "Course Schedule II", 'M', 12, "Akt3glAwyfY"),
  p("redundant-connection", "Redundant Connection", 'M', 12, "FXWRE67PLL0"),
  p("number-of-connected-components-in-an-undirected-graph", "Number of Connected Components In An Undirected Graph", 'M', 12, "8f1XPm4WOUc"),
  p("graph-valid-tree", "Graph Valid Tree", 'M', 12, "bXsUuownnoQ"),
  p("word-ladder", "Word Ladder", 'H', 12, "h9iTnkgv05E"),
  p("reconstruct-itinerary", "Reconstruct Itinerary", 'H', 13, "ZyB_gQ8vqGA"),
  p("min-cost-to-connect-all-points", "Min Cost to Connect All Points", 'M', 13, "f7JOBJIC-NA"),
  p("network-delay-time", "Network Delay Time", 'M', 13, "EaphyqKU4PQ"),
  p("swim-in-rising-water", "Swim In Rising Water", 'H', 13, "amvrKlMLuGY"),
  p("alien-dictionary", "Alien Dictionary", 'H', 13, "6kTZYvNNyps"),
  p("cheapest-flights-within-k-stops", "Cheapest Flights Within K Stops", 'M', 13, "5eIK3zUdYmE"),
  p("climbing-stairs", "Climbing Stairs", 'E', 14, "Y0lT9Fck7qI"),
  p("min-cost-climbing-stairs", "Min Cost Climbing Stairs", 'E', 14, "ktmzAZWkEZ0"),
  p("house-robber", "House Robber", 'M', 14, "73r3KWiEvyk"),
  p("house-robber-ii", "House Robber II", 'M', 14, "rWAJCfYYOvM"),
  p("longest-palindromic-substring", "Longest Palindromic Substring", 'M', 14, "XYQecbcd6_c"),
  p("palindromic-substrings", "Palindromic Substrings", 'M', 14, "4RACzI5-du8"),
  p("decode-ways", "Decode Ways", 'M', 14, "6aEyTjOwlJU"),
  p("coin-change", "Coin Change", 'M', 14, "H9bfqozjoqs"),
  p("maximum-product-subarray", "Maximum Product Subarray", 'M', 14, "lXVy6YWFcRM"),
  p("word-break", "Word Break", 'M', 14, "Sx9NNgInc3A"),
  p("longest-increasing-subsequence", "Longest Increasing Subsequence", 'M', 14, "cjWnW0hdF1Y"),
  p("partition-equal-subset-sum", "Partition Equal Subset Sum", 'M', 14, "IsvocB5BJhw"),
  p("unique-paths", "Unique Paths", 'M', 15, "IlEsdxuD4lY"),
  p("longest-common-subsequence", "Longest Common Subsequence", 'M', 15, "Ua0GhsJSlWM"),
  p("best-time-to-buy-and-sell-stock-with-cooldown", "Best Time to Buy And Sell Stock With Cooldown", 'M', 15, "I7j0F7AHpb8"),
  p("coin-change-ii", "Coin Change II", 'M', 15, "Mjy4hd2xgrs"),
  p("target-sum", "Target Sum", 'M', 15, "g0npyaQtAQM"),
  p("interleaving-string", "Interleaving String", 'M', 15, "3Rw3p9LrgvE"),
  p("longest-increasing-path-in-a-matrix", "Longest Increasing Path In a Matrix", 'H', 15, "wCc_nd-GiEc"),
  p("distinct-subsequences", "Distinct Subsequences", 'H', 15, "-RDzMJ33nx8"),
  p("edit-distance", "Edit Distance", 'M', 15, "XYi2-LPrwm4"),
  p("burst-balloons", "Burst Balloons", 'H', 15, "VFskby7lUbw"),
  p("regular-expression-matching", "Regular Expression Matching", 'H', 15, "HAA8mgxlov8"),
  p("single-number", "Single Number", 'E', 16, "qMPX1AOa83k"),
  p("number-of-1-bits", "Number of 1 Bits", 'E', 16, "5Km3utixwZs"),
  p("counting-bits", "Counting Bits", 'E', 16, "RyBM56RIWrM"),
  p("reverse-bits", "Reverse Bits", 'E', 16, "UcoN6UjAI64"),
  p("missing-number", "Missing Number", 'E', 16, "WnPLSRLSANE"),
  p("sum-of-two-integers", "Sum of Two Integers", 'M', 16, "gVUrDV4tZfY"),
  p("reverse-integer", "Reverse Integer", 'M', 16, "HAgLH58IgJQ"),
  p("rotate-image", "Rotate Image", 'M', 17, "fMSJSS7eO1w"),
  p("spiral-matrix", "Spiral Matrix", 'M', 17, "BJnMZNwUk1M"),
  p("set-matrix-zeroes", "Set Matrix Zeroes", 'M', 17, "T41rL0L3Pnw"),
  p("happy-number", "Happy Number", 'E', 17, "ljz85bxOYJ0"),
  p("plus-one", "Plus One", 'E', 17, "jIaA8boiG1s"),
  p("powx-n", "Pow(x, n)", 'M', 17, "g9YQyYi4IQQ"),
  p("multiply-strings", "Multiply Strings", 'M', 17, "1vZswirL8Y8"),
  p("detect-squares", "Detect Squares", 'M', 17, "bahebearrDc"),
];

export const NEETCODE_150_SLUGS: ReadonlySet<string> = new Set(NEETCODE_150.map((x) => x.slug));

export function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

export function videoUrl(video: string): string | null {
  return video ? `https://www.youtube.com/watch?v=${video}` : null;
}
