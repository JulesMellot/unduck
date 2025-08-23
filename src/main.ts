console.log('Executing new version of main.ts');
import { createClient } from '@supabase/supabase-js';

// Define types for better type safety
interface Bang {
  t: string; // bang key
  s: string; // name
  u: string; // url template
  d: string; // domain
  // Optional properties from the original bang.ts structure
  c?: string;
  r?: number;
  sc?: string;
}

// Supabase client type
interface SupabaseClient {
  from: (table: string) => any;
  // Add other methods as needed
}

// DOM Elements
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const defaultSearchEngineSelect = document.getElementById('defaultSearchEngine') as HTMLSelectElement;
const bangsGrid = document.getElementById('bangsGrid') as HTMLDivElement;
const bangModal = document.getElementById('bangModal') as HTMLDivElement;
const bangForm = document.getElementById('bangForm') as HTMLFormElement;
const modalTitle = document.getElementById('modalTitle') as HTMLHeadingElement;
const editIndexInput = document.getElementById('editIndex') as HTMLInputElement;
const bangKeyInput = document.getElementById('bangKey') as HTMLInputElement;
const bangNameInput = document.getElementById('bangName') as HTMLInputElement;
const bangUrlInput = document.getElementById('bangUrl') as HTMLTextAreaElement;
const bangDomainInput = document.getElementById('bangDomain') as HTMLInputElement;
const addBangBtn = document.getElementById('addBangBtn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
const deleteBtn = document.getElementById('deleteBtn') as HTMLButtonElement;
const closeModalSpan = document.querySelector('.close') as HTMLSpanElement;
const copyButton = document.getElementById('copyButton') as HTMLButtonElement;
const urlInput = document.querySelector('.url-input') as HTMLInputElement;

// State
let customBangs: Bang[] = [];
let allBangs: Bang[] = [];
let filteredBangs: Bang[] = [];

// Load hidden bangs from localStorage
function loadHiddenBangs() {
  const storedHiddenBangs = localStorage.getItem('hiddenBangs');
  if (storedHiddenBangs) {
    try {
      return JSON.parse(storedHiddenBangs);
    } catch (e) {
      console.error('Error parsing hidden bangs from localStorage', e);
      return [];
    }
  }
  return [];
}

// Save hidden bangs to localStorage
function saveHiddenBangs(hiddenBangs: string[]) {
  localStorage.setItem('hiddenBangs', JSON.stringify(hiddenBangs));
}

// Merge default and custom bangs, excluding hidden bangs
function mergeBangs() {
  // Initialize with empty array since we're not using default bangs
  const visibleDefaultBangs: Bang[] = [];
  
  allBangs = [...visibleDefaultBangs, ...customBangs];
  filteredBangs = [...allBangs];
}

// Initialize the app
async function init() {
  setupEventListeners();
  loadDefaultSearchEngine();
  setupCopyButton();
  updateServiceUrl();
  searchInput.focus();

  const storedBangs = localStorage.getItem("customBangs");
  if (storedBangs) {
    try {
      customBangs = JSON.parse(storedBangs);
      allBangs = [...customBangs];
      filteredBangs = [...allBangs];
      renderBangsGrid();
      console.log("Loaded", customBangs.length, "bangs from localStorage");
      handleDefaultSearchEngineChange();
    } catch (e) {
      console.error("Error parsing bangs from localStorage", e);
    }
  }

  await initSupabaseSync();
  handleInitialRedirect();
}

// Update the service URL in the input field
function updateServiceUrl() {
  if (urlInput) {
    // Get the current origin (protocol + hostname + port)
    const origin = window.location.origin;
    urlInput.value = `${origin}/?q=%s`;
  }
}

// Set up the copy button functionality
function setupCopyButton() {
  if (copyButton && urlInput) {
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(urlInput.value);
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span>Copied!</span>';
        
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        urlInput.select();
        document.execCommand('copy');
        
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span>Copied!</span>';
        
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      }
    });
  }
}

// Load custom bangs from localStorage
function loadCustomBangs() {
  const storedCustomBangs = localStorage.getItem('customBangs');
  if (storedCustomBangs) {
    try {
      customBangs = JSON.parse(storedCustomBangs);
    } catch (e) {
      console.error('Error parsing custom bangs from localStorage', e);
      customBangs = [];
    }
  }
  
  // Initialize Supabase sync
  initSupabaseSync();
}

// Initialize Supabase client
let supabase: SupabaseClient | null = null;

async function initSupabaseSync() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Supabase not configured, using local storage only');
      return;
    }
    
    const module = await import('@supabase/supabase-js');
    const { createClient } = module;
    
    supabase = createClient(supabaseUrl, supabaseKey) as SupabaseClient;
    await syncWithSupabase();
  } catch (err) {
    console.warn('Failed to load Supabase client:', err);
  }
}

// Sync with Supabase
async function syncWithSupabase() {
  if (!supabase) return;
  
  try {
    // Get last sync timestamp from localStorage
    const lastSyncTime = localStorage.getItem('lastSyncTime');
    console.log('syncWithSupabase: local last update time =', lastSyncTime);
    
    // Check if we need to sync with Supabase
    const { data: lastUpdate, error: updateError } = await supabase
      .from('metadata')
      .select('last_updated')
      .eq('key', 'bangs_last_updated')
      .single();
    
    if (updateError) {
      if (updateError.code === 'PGRST116') {
        // The row does not exist, so this is the first sync.
        // Send the local bangs to Supabase.
        console.log('syncWithSupabase: no cloud metadata found, sending local bangs to Supabase');
        await sendBangsToSupabase();
      } else {
        console.error('Error checking last update time:', updateError);
      }
      return;
    }

    console.log('syncWithSupabase: cloud last update time =', lastUpdate.last_updated);
    
    // If we've never synced or Supabase has newer data, fetch from Supabase
    if (!lastSyncTime || (lastUpdate && new Date(lastUpdate.last_updated) > new Date(lastSyncTime))) {
      console.log('syncWithSupabase: cloud is newer, fetching from Supabase');
      await fetchBangsFromSupabase();
    } 
    // If local data is newer, send to Supabase
    else if (lastSyncTime) {
      const localLastUpdated = new Date(lastSyncTime);
      if (lastUpdate && localLastUpdated > new Date(lastUpdate.last_updated)) {
        console.log('syncWithSupabase: local is newer, sending to Supabase');
        await sendBangsToSupabase();
      } else {
        console.log('syncWithSupabase: local and cloud are in sync');
        if (customBangs.length === 0) {
          console.log('syncWithSupabase: local storage is empty, fetching from Supabase');
          await fetchBangsFromSupabase();
        }
      }
    }
  } catch (err) {
    console.warn('Error during Supabase sync:', err);
  }
}

// Fetch bangs from Supabase
async function fetchBangsFromSupabase() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase
      .from('bangs')
      .select('*');
    
    if (error) {
      console.warn('Error fetching bangs from Supabase:', error);
      return;
    }
    
    if (data) {
      const supabaseBangs: Bang[] = data.map((item: any) => ({
        t: item.key,
        s: item.name,
        u: item.url,
        d: item.domain,
        c: item.category,
        r: item.rank,
        sc: item.subcategory
      }));

      // Update local storage with Supabase data
      customBangs = supabaseBangs;
      localStorage.setItem('customBangs', JSON.stringify(customBangs));
      
      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem('lastSyncTime', now);
      
      // Refresh UI
      mergeBangs();
      renderBangsGrid();
      handleDefaultSearchEngineChange();
    }
  } catch (err) {
    console.warn('Error updating local bangs from Supabase:', err);
  }
}

// Send bangs to Supabase
async function sendBangsToSupabase() {
  if (!supabase) return;
  
  try {
    // Update last updated timestamp in Supabase
    const now = new Date().toISOString();
    
    // First update the metadata
    await supabase
      .from('metadata')
      .upsert({ 
        key: 'bangs_last_updated', 
        last_updated: now 
      });
    
    // Then update the bangs
    // Note: This is a simplified approach - in reality, you'd want to handle this more carefully
    // to avoid overwriting changes made on other devices
    for (const bang of customBangs) {
      await supabase
        .from('bangs')
        .upsert({
          ...bang,
          updated_at: now
        });
    }
    
    // Update local sync time
    localStorage.setItem('lastSyncTime', now);
  } catch (err) {
    console.warn('Error sending bangs to Supabase:', err);
  }
}

// Sync a single bang with Supabase
async function syncSingleBangWithSupabase(bang: Bang, isNew: boolean) {
  if (!supabase) return;
  
  try {
    const now = new Date().toISOString();
    
    // Update the specific bang in Supabase
    const { error } = await supabase
      .from('bangs')
      .upsert({
        key: bang.t,
        name: bang.s,
        url: bang.u,
        domain: bang.d,
        updated_at: now
      });
    
    if (error) {
      console.warn('Error syncing single bang with Supabase:', error);
      return;
    }
    
    // Update metadata timestamp
    await supabase
      .from('metadata')
      .upsert({ 
        key: 'bangs_last_updated', 
        last_updated: now 
      });
    
    // Update local sync time
    localStorage.setItem('lastSyncTime', now);
    
    console.log(`Successfully synced bang '${bang.t}' with Supabase`);
  } catch (err) {
    console.warn('Error syncing single bang with Supabase:', err);
  }
}

// Delete a bang from Supabase
async function deleteBangFromSupabase(bang: Bang) {
  if (!supabase) return;
  
  try {
    const now = new Date().toISOString();
    
    // Delete the specific bang from Supabase
    const { error } = await supabase
      .from('bangs')
      .delete()
      .eq('key', bang.t);
    
    if (error) {
      console.warn('Error deleting bang from Supabase:', error);
      return;
    }
    
    // Update metadata timestamp
    await supabase
      .from('metadata')
      .upsert({ 
        key: 'bangs_last_updated', 
        last_updated: now 
      });
    
    // Update local sync time
    localStorage.setItem('lastSyncTime', now);
    
    console.log(`Successfully deleted bang '${bang.t}' from Supabase`);
  } catch (err) {
    console.warn('Error deleting bang from Supabase:', err);
  }
}

// Save bang (add or edit)
async function saveBang(e: Event) {
  e.preventDefault();
  
  const index = editIndexInput.value;
  const bang: Bang = {
    t: bangKeyInput.value,
    s: bangNameInput.value,
    u: bangUrlInput.value,
    d: bangDomainInput.value
  };
  
  const isNew = index === '';
  
  if (isNew) {
    // Add new bang
    customBangs.push(bang);
  } else {
    // Edit existing bang
    customBangs[parseInt(index)] = bang;
  }
  
  // Save to localStorage
  localStorage.setItem('customBangs', JSON.stringify(customBangs));
  
  // Refresh bangs
  allBangs = [...customBangs];
  renderBangsGrid();
  handleDefaultSearchEngineChange();
  closeBangModal();
  
  // Sync with Supabase
  await syncSingleBangWithSupabase(bang, isNew);
}

// Enhanced deleteBang function with Supabase sync
async function deleteBang() {
  const indexStr = editIndexInput.value;
  if (indexStr === '') {
    alert('No bang selected for deletion.');
    return;
  }
  
  const index = parseInt(indexStr, 10);
  if (index < 0 || index >= allBangs.length) {
    alert('Invalid bang index.');
    return;
  }
  
  // Check if it's a default bang
  // Since we're not using default bangs, all bangs are custom
  if (index < 0) {
    // This condition should never be true, but we keep it for safety
    console.warn("Unexpected index for default bangs");
  } else {
    // Get the bang to delete
    const bangToDelete = customBangs[index];
    
    // For custom bangs, we delete them
    // Since we're not using default bangs, we can directly splice from customBangs
    customBangs.splice(index, 1);
    // Save to localStorage
    localStorage.setItem('customBangs', JSON.stringify(customBangs));
    
    // Try to delete from Supabase
    await deleteBangFromSupabase(bangToDelete);
  }
  
  // Update last sync time
  const now = new Date().toISOString();
  localStorage.setItem('lastSyncTime', now);
  
  // Refresh bangs
  mergeBangs();
  handleDefaultSearchEngineChange();
  handleSearch(); // Re-apply search filter
  closeBangModal();
}

// Load default search engine from localStorage
function loadDefaultSearchEngine() {
  const savedEngine = localStorage.getItem('defaultSearchEngine');
  if (savedEngine) {
    defaultSearchEngineSelect.value = savedEngine;
  }
}

// Set up event listeners
function setupEventListeners() {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      redirectToSearch(searchInput.value);
    }
  });
  searchInput.addEventListener('input', handleSearch);
  defaultSearchEngineSelect.addEventListener('change', handleDefaultSearchEngineChange);
  addBangBtn.addEventListener('click', openAddBangModal);
  bangForm.addEventListener('submit', saveBang);
  cancelBtn.addEventListener('click', closeBangModal);
  deleteBtn.addEventListener('click', deleteBang);
  closeModalSpan.addEventListener('click', closeBangModal);
  window.addEventListener('click', (e) => {
    if (e.target === bangModal) {
      closeBangModal();
    }
  });
  
  // Optional: Add a keyboard shortcut for the search (Cmd/Ctrl + K)
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    searchInput.focus();
  }
});

// Focus the search input on page load
searchInput.focus();

// Update the service URL when the window location changes (for SPA navigation)
  window.addEventListener('popstate', updateServiceUrl);
}

// Enhanced search function with filters
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    // If search is empty, show all bangs
    filteredBangs = [...allBangs];
    renderBangsGrid();
    return;
  }
  
  // Check for filters
  const filters: { type: string; value: string }[] = [];
  const regularTerms: string[] = [];
  
  // Split search term by spaces and process each part
  const terms = searchTerm.split(/\s+/).filter(term => term.length > 0);
  
  terms.forEach(term => {
    // Check for filter pattern (filter:value)
    const filterMatch = term.match(/^(\w+):(.+)$/);
    if (filterMatch) {
      const filterType = filterMatch[1].toLowerCase();
      const filterValue = filterMatch[2].toLowerCase();
      filters.push({ type: filterType, value: filterValue });
    } else {
      regularTerms.push(term);
    }
  });
  
  // Filter bangs based on filters and regular terms
  let resultBangs = [...allBangs];
  
  // Apply filters
  filters.forEach(filter => {
    switch (filter.type) {
      case 'bang':
      case 'key':
        resultBangs = resultBangs.filter(bang => bang.t.toLowerCase().includes(filter.value));
        break;
      case 'domain':
        resultBangs = resultBangs.filter(bang => bang.d.toLowerCase().includes(filter.value));
        break;
      case 'name':
        resultBangs = resultBangs.filter(bang => bang.s.toLowerCase().includes(filter.value));
        break;
      default:
        // For unknown filters, treat as regular term
        regularTerms.push(`${filter.type}:${filter.value}`);
        break;
    }
  });
  
  // Apply regular search terms if any
  if (regularTerms.length > 0) {
    const searchWords = regularTerms;
    
    // Score each bang based on relevance
    const scoredBangs = resultBangs.map(bang => {
      let score = 0;
      
      // Convert bang properties to lowercase for comparison
      const bangKey = bang.t.toLowerCase();
      const bangName = bang.s.toLowerCase();
      const bangDomain = bang.d.toLowerCase();
      
      // Check each word in the search term
      searchWords.forEach(word => {
        // Exact match in bang key (highest priority)
        if (bangKey === word) {
          score += 100;
        } 
        // Starts with match in bang key (high priority)
        else if (bangKey.startsWith(word)) {
          score += 50;
        } 
        // Contains match in bang key (medium priority)
        else if (bangKey.includes(word)) {
          score += 20;
        }
        
        // Contains match in bang name (lower priority)
        if (bangName.includes(word)) {
          score += 10;
        }
        
        // Contains match in bang domain (lowest priority)
        if (bangDomain.includes(word)) {
          score += 5;
        }
      });
      
      return { bang, score };
    });
    
    // Filter out bangs with score 0 (no matches)
    const matchedBangs = scoredBangs.filter(item => item.score > 0);
    
    // Sort by score (descending)
    matchedBangs.sort((a, b) => b.score - a.score);
    
    // Extract the sorted bangs
    resultBangs = matchedBangs.map(item => item.bang);
  }
  
  filteredBangs = resultBangs;
  renderBangsGrid();
}

// Handle default search engine change
function handleDefaultSearchEngineChange() {
  const defaultEngineKey = defaultSearchEngineSelect.value;
  localStorage.setItem('defaultSearchEngine', defaultEngineKey);
  const defaultBang = allBangs.find(b => b.t === defaultEngineKey);
  if (defaultBang) {
    localStorage.setItem('defaultBang', JSON.stringify(defaultBang));
    showNotification(`Default search engine changed to ${defaultBang.s}`, 'success');
  }
}

// Render bangs grid
function renderBangsGrid() {
  bangsGrid.innerHTML = '';
  
  if (filteredBangs.length === 0) {
    bangsGrid.innerHTML = '<p>No bangs found.</p>';
    return;
  }
  
  filteredBangs.forEach((bang) => {
    const bangCard = document.createElement('div');
    bangCard.className = 'bang-card';
    
    // Check if this is a custom bang (not in default bangs)
    // Since we're not using default bangs, all bangs are considered custom
    const isCustomBang = true;
    
    bangCard.innerHTML = `
      <div class="bang-header">
        <div class="bang-key">!${bang.t}</div>
        <button class="edit-bang-btn" data-bang-key="${bang.t}" data-is-custom="${isCustomBang}"><i class="lni lni-pencil-1"></i></button>
      </div>
      <div class="bang-name">${bang.s}</div>
      <div class="bang-domain">${bang.d}</div>
    `;
    
    bangCard.addEventListener('click', () => {
      // When a bang card is clicked, populate the search box with the bang and focus it
      const currentQuery = searchInput.value.replace(/!\S+/, '').trim();
      searchInput.value = `!${bang.t} ${currentQuery}`;
      searchInput.focus();
    });
    
    bangsGrid.appendChild(bangCard);
  });
  
  // Add event listeners to edit buttons
  document.querySelectorAll('.edit-bang-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the card click event
      const bangKey = (e.target as HTMLButtonElement).getAttribute('data-bang-key') || '';
      const isCustomBang = (e.target as HTMLButtonElement).getAttribute('data-is-custom') === 'true';
      // Find the bang in allBangs array
      const bang = allBangs.find(b => b.t === bangKey);
      if (bang) {
        openEditBangModal(bang, isCustomBang);
      }
    });
  });
}

// Open modal for adding a new bang
function openAddBangModal() {
  modalTitle.textContent = 'Add Custom Bang';
  bangForm.reset();
  editIndexInput.value = '';
  deleteBtn.style.display = 'none';
  bangModal.style.display = 'flex';
}

// Open modal for editing a bang
function openEditBangModal(bang: Bang, isCustomBang: boolean = false) {
  modalTitle.textContent = isCustomBang ? 'Edit Custom Bang' : 'Edit Bang';
  bangKeyInput.value = bang.t;
  bangNameInput.value = bang.s;
  bangUrlInput.value = bang.u;
  bangDomainInput.value = bang.d || '';
  
  // Find the index of this bang in the allBangs array
  const index = allBangs.findIndex(b => 
    b.t === bang.t && 
    b.s === bang.s && 
    b.u === bang.u && 
    b.d === bang.d
  );
  
  if (index !== -1) {
    editIndexInput.value = index.toString();
    // For default bangs, hide the delete button
    deleteBtn.style.display = isCustomBang ? 'inline-block' : 'none';
    bangModal.style.display = 'flex';
  } else {
    alert('Could not find the selected bang.');
  }
}

// Close bang modal
function closeBangModal() {
  bangModal.style.display = 'none';
}

// Get the default bang based on selected search engine
function getDefaultBang(): Bang | undefined {
  const defaultEngineKey = defaultSearchEngineSelect.value;
  console.log('getDefaultBang: defaultEngineKey =', defaultEngineKey);
  console.log('getDefaultBang: customBangs =', JSON.stringify(customBangs));
  let defaultBang = customBangs.find(b => b.t === defaultEngineKey);
  console.log('getDefaultBang: found defaultBang =', defaultBang);
  return defaultBang;
}

// Get the redirect URL based on query and bang
function getBangRedirectUrl(query: string): string | null {
  console.log('getBangRedirectUrl: received query =', query);

  if (!query) {
    return null;
  }

  const match = query.match(/!(\S+)/i);
  const bangCandidate = match?.[1]?.toLowerCase();
  console.log('getBangRedirectUrl: bangCandidate =', bangCandidate);
  
  let selectedBang: Bang | undefined;
  if (bangCandidate) {
    // Find the specific bang
    selectedBang = allBangs.find(b => b.t === bangCandidate);
  } else {
    // Use default bang
    selectedBang = getDefaultBang();
  }
  console.log('getBangRedirectUrl: selectedBang =', selectedBang);

  if (!selectedBang) {
    // If no bang found, use default search engine directly
    const defaultBang = getDefaultBang();
    if (defaultBang) {
      const redirectUrl = defaultBang.u.replace("{{{s}}}", encodeURIComponent(query));
      console.log('getBangRedirectUrl: no selectedBang, using default, redirectUrl =', redirectUrl);
      return redirectUrl;
    }
    console.log('getBangRedirectUrl: no selectedBang and no default bang found');
    return null;
  }

  // Remove the first bang from the query
  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "") {
    const redirectUrl = `https://${selectedBang.d}`;
    console.log('getBangRedirectUrl: cleanQuery is empty, redirecting to domain, redirectUrl =', redirectUrl);
    return redirectUrl;
  }

  // Format the URL
  const searchUrl = selectedBang.u.replace(
    "{{{s}}}",
    // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/"),
  );
  
  console.log('getBangRedirectUrl: final searchUrl =', searchUrl);
  return searchUrl || null;
}

// Handle initial redirect if there's a query parameter
function handleInitialRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  
  console.log('handleInitialRedirect: query from URL =', query);

  if (query) {
    redirectToSearch(query);
  }
}

// Perform the redirect
function redirectToSearch(query: string) {
  const redirectUrl = getBangRedirectUrl(query);
  if (redirectUrl) {
    window.location.replace(redirectUrl);
  } else {
    alert('Unable to determine redirect URL. Please check your bang or default search engine.');
  }
}

// Load bangs from Supabase
async function loadBangsFromSupabase() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("Supabase not configured");
      return;
    }
    
    const module = await import('@supabase/supabase-js');
    const { createClient } = module;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('bangs')
      .select('*');
      
    if (error) {
      console.error("Error fetching bangs from Supabase:", error);
      return;
    }
    
    if (data) {
      // Convert Supabase data to Bang format
      const supabaseBangs: Bang[] = data.map((item: any) => ({
        t: item.key,
        s: item.name,
        u: item.url,
        d: item.domain,
        c: item.category,
        r: item.rank,
        sc: item.subcategory
      }));
      
      // Store in localStorage
      localStorage.setItem("customBangs", JSON.stringify(supabaseBangs));
      
      // Update global variables
      customBangs = supabaseBangs;
      allBangs = [...customBangs];
      filteredBangs = [...allBangs];
      
      // Render bangs grid
      renderBangsGrid();
      
      console.log("Loaded", supabaseBangs.length, "bangs from Supabase");
    }
  } catch (error) {
    console.error("Error loading bangs from Supabase:", error);
  }
}

// Show popup to create first bang
function showCreateFirstBangPopup() {
  // For now, we'll just show an alert
  // In a real implementation, you'd show a modal popup
  alert("No bangs found in database. Please add some bangs using the 'Add Custom Bang' button.");
}

// Show popup to create table
function showCreateTablePopup() {
  alert("The 'bangs' table does not exist in your Supabase database. Please create it in your Supabase dashboard:\n\n" +
    "1. Go to your Supabase dashboard\n" +
    "2. Go to the 'Table Editor' tab\n" +
    "3. Click 'New Table'\n" +
    "4. Name the table 'bangs'\n" +
    "5. Add the following columns:\n" +
    "   - key (text, primary key)\n" +
    "   - name (text)\n" +
    "   - url (text)\n" +
    "   - domain (text)\n" +
    "   - category (text, nullable)\n" +
    "   - subcategory (text, nullable)\n" +
    "   - rank (integer, nullable)\n" +
    "6. Click 'Save'");
}

// Create first bang in Supabase
async function createFirstBang() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("Supabase not configured");
      return;
    }
    
    const module = await import('@supabase/supabase-js');
    const { createClient } = module;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Example first bang
    const firstBang = {
      key: "g",
      name: "Google",
      url: "https://www.google.com/search?q={{{s}}}",
      domain: "www.google.com"
    };
    
    const { error } = await supabase
      .from('bangs')
      .insert([firstBang]);
      
    if (error) {
      console.error("Error creating first bang:", error);
      return;
    }
    
    console.log("First bang created successfully");
    // Reload bangs
    loadBangsFromSupabase();
  } catch (error) {
    console.error("Error creating first bang:", error);
  }
}

// Sync bangs with Supabase
async function syncBangsWithSupabase() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("Supabase not configured");
      return;
    }
    
    const module = await import('@supabase/supabase-js');
    const { createClient } = module;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get bangs from localStorage
    const storedBangs = localStorage.getItem("customBangs");
    const localBangs: Bang[] = storedBangs ? JSON.parse(storedBangs) : [];
    
    // Get bangs from Supabase
    const { data: supabaseBangs, error: fetchError } = await supabase
      .from('bangs')
      .select('*');
      
    if (fetchError) {
      console.error("Error fetching bangs from Supabase:", fetchError);
      return;
    }
    
    // Compare and sync
    // For simplicity, we'll just upsert local bangs to Supabase
    // This will insert new bangs or update existing ones
    
    if (localBangs.length > 0) {
      // Prepare bangs for upsert
      const bangsToUpsert = localBangs.map(bang => ({
        key: bang.t,
        name: bang.s,
        url: bang.u,
        domain: bang.d,
        category: bang.c,
        rank: bang.r,
        subcategory: bang.sc
      }));
      
      const { error: upsertError } = await supabase
        .from('bangs')
        .upsert(bangsToUpsert, {
          onConflict: 'key'
        });
        
      if (upsertError) {
        console.error("Error upserting bangs to Supabase:", upsertError);
        // Handle duplicate key error specifically
        if (upsertError.code === '23505') {
          console.log("Some bangs already exist in Supabase, but we're using upsert to handle this");
        }
        return;
      }
    }
    
    console.log("Bangs synced with Supabase successfully");
  } catch (error) {
    console.error("Error syncing bangs with Supabase:", error);
  }
}

// Show notification message
function showNotification(message: string, type: string = 'success') {
  // Remove any existing notifications
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-message">${message}</div>
    <button class="toast-close">&times;</button>
  `;

  toastContainer.appendChild(toast);

  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // Add close event listener
  const closeButton = toast.querySelector('.toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    });
  }

  // Auto close after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }, 3000);
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  init();
  if (addBangBtn) {
    addBangBtn.addEventListener('click', openAddBangModal);
  }
});
