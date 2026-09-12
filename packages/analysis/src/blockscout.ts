export type BlockscoutTransactionItem = {
  hash: string;
  timestamp: string;
  status: string;
  result?: string;
  block_number: number;
  from: {
    hash: string;
    [key: string]: unknown;
  };
  to: {
    hash: string | null;
    [key: string]: unknown;
  } | null;
  method?: string | null;
  fee?: {
    type?: string;
    value?: string;
  };
  value?: string;
  [key: string]: unknown;
};

export type BlockscoutNextPageParams = {
  block_number: number;
  index: number;
  items_count: number;
  fee: string;
  hash: string;
  inserted_at: string;
  value: string;
  filter?: string;
};

export type BlockscoutPageResponse = {
  items: BlockscoutTransactionItem[];
  next_page_params: BlockscoutNextPageParams | null;
};

export type FetchBlockscoutOptions = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  cursor?: BlockscoutNextPageParams | null;
  filter?: "from" | "to";
};

export type FetchHistoryOptions = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  maxPages?: number;
  stopBeforeTimestamp?: string;
};

export type FetchHistoryResult = {
  items: BlockscoutTransactionItem[];
  pageCount: number;
  reachedEnd: boolean;
  hitPageLimit: boolean;
  rawPages: BlockscoutPageResponse[];
};

/**
 * Fetches a single page of transactions for an address from Blockscout REST v2.
 * Throws actionable errors on network failure, non-2xx status, or malformed JSON.
 */
export async function fetchBlockscoutPage(
  address: string,
  options?: FetchBlockscoutOptions
): Promise<BlockscoutPageResponse> {
  const fetchImpl = options?.fetchFn || fetch;
  const baseUrl = (options?.baseUrl || process.env.BLOCKSCOUT_API_BASE_URL || "https://eth.blockscout.com/api/v2").replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/addresses/${address}/transactions`);
  url.searchParams.set("filter", options?.filter || "from");

  if (options?.cursor) {
    const c = options.cursor;
    url.searchParams.set("block_number", String(c.block_number));
    url.searchParams.set("index", String(c.index));
    url.searchParams.set("items_count", String(c.items_count));
    url.searchParams.set("fee", String(c.fee));
    url.searchParams.set("hash", String(c.hash));
    url.searchParams.set("inserted_at", String(c.inserted_at));
    url.searchParams.set("value", String(c.value));
  }

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { Accept: "application/json" }
    });
  } catch (err) {
    throw new Error(`Blockscout network request failed for ${url.toString()}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    throw new Error(`Blockscout API error: HTTP ${response.status} ${response.statusText} from ${url.toString()}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Blockscout returned malformed JSON from ${url.toString()}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof data !== "object" || data === null || !Array.isArray((data as BlockscoutPageResponse).items)) {
    throw new Error(`Blockscout response missing expected 'items' array from ${url.toString()}`);
  }

  const page = data as BlockscoutPageResponse;
  return {
    items: page.items,
    next_page_params: page.next_page_params ?? null
  };
}

/**
 * Paginates through Blockscout address transactions until next_page_params is null,
 * maxPages is hit, or all transactions on the page are older than stopBeforeTimestamp.
 */
export async function fetchBlockscoutHistory(
  address: string,
  options?: FetchHistoryOptions
): Promise<FetchHistoryResult> {
  const maxPages = options?.maxPages ?? 10;
  const items: BlockscoutTransactionItem[] = [];
  const rawPages: BlockscoutPageResponse[] = [];
  let cursor: BlockscoutNextPageParams | null = null;
  let pageCount = 0;
  let reachedEnd = false;
  let hitPageLimit = false;

  while (pageCount < maxPages) {
    const page: BlockscoutPageResponse = await fetchBlockscoutPage(address, {
      baseUrl: options?.baseUrl,
      fetchFn: options?.fetchFn,
      cursor,
      filter: "from"
    });

    pageCount++;
    rawPages.push(page);
    items.push(...page.items);

    if (!page.next_page_params) {
      reachedEnd = true;
      break;
    }

    cursor = page.next_page_params;

    // Early termination if all items on the page are past the observation window
    if (options?.stopBeforeTimestamp && page.items.length > 0) {
      const stopTime = new Date(options.stopBeforeTimestamp).getTime();
      const newestOnPage = new Date(page.items[0].timestamp).getTime();
      const oldestOnPage = new Date(page.items[page.items.length - 1].timestamp).getTime();
      if (oldestOnPage < stopTime) {
        reachedEnd = true;
        break;
      }
    }
  }

  if (!reachedEnd && cursor !== null) {
    hitPageLimit = true;
  }

  return {
    items,
    pageCount,
    reachedEnd,
    hitPageLimit,
    rawPages
  };
}
