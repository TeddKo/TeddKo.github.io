import type { Category } from "@/utils/categories";

export interface UIStrings {
  nav: {
    home: string;
    posts: string;
    tags: string;
    about: string;
    archives: string;
    search: string;
    dataStructure: string;
    algorithm: string;
    cs: string;
    language: string;
    mobile: string;
    server: string;
    projects: string;
  };
  post: {
    publishedAt: string;
    updatedAt: string;
    sharePostIntro: string;
    sharePostOn: string;
    sharePostViaEmail: string;
    tagLabel: string;
    backToTop: string;
    goBack: string;
    editPage: string;
    previousPost: string;
    nextPost: string;
  };
  pagination: {
    prev: string;
    next: string;
    page: string;
  };
  home: {
    socialLinks: string;
    featured: string;
    recentPosts: string;
    allPosts: string;
  };
  footer: {
    copyright: string;
    allRightsReserved: string;
  };
  pages: {
    tagTitle: string;
    tagDesc: string;

    tagsTitle: string;
    tagsDesc: string;

    postsTitle: string;
    postsDesc: string;

    archivesTitle: string;
    archivesDesc: string;

    searchTitle: string;
    searchDesc: string;
  };
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    mainNav: string;
    menu: string;
    toggleTheme: string;
    searchPlaceholder: string;
    noResults: string;
    goToPreviousPage: string;
    goToNextPage: string;
  };
  notFound: {
    title: string;
    message: string;
    goHome: string;
  };
  /** Category listing pages (/cs, /algorithm, /language, /mobile, ...) */
  categories: {
    /** Display name per post category, keyed by the slug in CATEGORIES */
    labels: Record<Category, string>;
    csEyebrow: string;
    csDesc: string;
    dataStructureEyebrow: string;
    dataStructureDesc: string;
    algorithmEyebrow: string;
    algorithmDesc: string;
    serverEyebrow: string;
    serverDesc: string;
    languageEyebrow: string;
    languageDesc: string;
    languageFilterLabel: string;
    mobileEyebrow: string;
    mobileDesc: string;
    mobileFilterLabel: string;
    /** Sub-category page description. `{{label}}` is the sub-category name. */
    subDesc: string;
    /** "All" entry in the sub-category filter */
    filterAll: string;
    /** Shown when a category has no posts yet */
    empty: string;
  };
  projects: {
    eyebrow: string;
    /** Eyebrow on an individual project detail page */
    detailEyebrow: string;
    description: string;
    detailLink: string;
    members: string;
    viewOriginal: string;
    backToList: string;
  };
  card: {
    featured: string;
  };
  more: {
    expand: string;
    collapse: string;
  };
  /** Client-side post list with category/tag filters */
  postBrowser: {
    categoryNav: string;
    tagNav: string;
    tagAll: string;
    /** `{{n}}` is the number of matching posts */
    countLabel: string;
    empty: string;
    reset: string;
  };
  search: {
    label: string;
    clear: string;
    loading: string;
    devNoticeTitle: string;
    devNoticeBody: string;
    error: string;
    /** `{{n}}` is the number of hits */
    resultCount: string;
    resultsNav: string;
    more: string;
  };
  /** Shared playback controls for the in-post visualizations */
  viz: {
    region: string;
    first: string;
    prev: string;
    play: string;
    pause: string;
    next: string;
    /** `{{speed}}` is the playback multiplier */
    speedLabel: string;
    seek: string;
  };
}
