/**
 * Pegasus group search + primary/secondary group create-or-get helpers.
 */

const { resolveApiAuthenticateToken } = require('../pegasus/auth-token');

function createGroupHelpers({ pegasus, currentConfig }) {
  const apiToken = () => resolveApiAuthenticateToken(currentConfig);
  // Helper function to search for existing group by name using the correct API format
  async function searchGroupByName(groupName) {
    try {
      const searchPath = `/groups?select=name&search.name="${encodeURIComponent(groupName)}"`;
      console.log(
        `   🔍 Searching for group with API: ${pegasus.stripUrlForLog(pegasus.apiBase + searchPath)}`
      );

      const searchResponse = await pegasus.apiGet(
        "search-group-by-name",
        searchPath,
        apiToken(),
        30000
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log(`   🔍 Search response:`, JSON.stringify(searchData, null, 2));

        // Handle different response structures: array directly or data property
        let groups = null;
        if (Array.isArray(searchData)) {
          groups = searchData;
        } else if (searchData && searchData.data && Array.isArray(searchData.data)) {
          groups = searchData.data;
        }

        if (groups && groups.length > 0) {
          const existingGroup = groups[0];
          const existingGroupId = existingGroup.id || existingGroup._id;
          console.log(`   ✅ Found existing group with ID: ${existingGroupId}`);
          return existingGroupId;
        } else {
          console.log(`   ℹ️  No existing group found with name: ${groupName}`);
          return null;
        }
      } else {
        const errorText = await searchResponse.text();
        console.log(`   ⚠️  Search failed with status ${searchResponse.status}: ${errorText}`);
        return null;
      }
    } catch (searchError) {
      console.log(`   ⚠️  Could not search for existing group: ${searchError.message}`);
      return null;
    }
  }

  // Get or create group in Pegasus - idempotent and non-blocking
  async function createOrUpdateGroup(clientName) {
    try {
      // Clean up unwanted "NA" suffixes from client name (handles " NA", " NA/", " NA /", etc.)
      clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();

      console.log(`   Getting or creating group for client: ${clientName}`);

      // First, check if a group with this name already exists
      console.log(`   🔍 Step 1: Checking if group "${clientName}" already exists...`);
      const existingGroupId = await searchGroupByName(clientName);

      if (existingGroupId) {
        console.log(`   ✅ Group already exists with ID: ${existingGroupId} - will use existing group`);
        return { groupId: existingGroupId, created: false };
      }

      // Group doesn't exist, so create it
      console.log(`   📝 Step 2: Group does not exist, creating new group...`);

      // Build group payload based on dossier specifications
      const groupPayload = {
        name: clientName,
        company_name: clientName,
        address_1: "",
        logo: null,
        contact_email: "",
        contact_name: clientName,
        city: "",
        country: "Mexico", // Default as specified in dossier
      };

      console.log(`   Group payload:`, JSON.stringify(groupPayload, null, 2));

      const response = await pegasus.apiPost(
        "create-group",
        "/groups",
        groupPayload,
        apiToken(),
        30000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pegasus API call failed: ${response.status} - ${errorText}`);
      }

      const groupData = await response.json();
      console.log(`   Group creation response:`, JSON.stringify(groupData, null, 2));

      // Extract group ID from response
      const groupId = groupData.id || groupData._id;
      if (!groupId) {
        throw new Error("No group ID returned from Pegasus");
      }

      console.log(`   ✅ Group created successfully with ID: ${groupId}`);
      return { groupId, created: true };
    } catch (error) {
      console.error(`   ❌ Fatal error in group operation: ${error.message}`);
      throw error;
    }
  }

  // Create or get secondary group with naming pattern "client (2)"
  async function createOrUpdateSecondaryGroup(clientName) {
    try {
      // Clean up unwanted "NA" suffixes from client name (handles " NA", " NA/", " NA /", etc.)
      clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();

      const secondaryGroupName = `${clientName} (2)`;
      console.log(`   Getting or creating secondary group for client: ${secondaryGroupName}`);

      // First, check if a secondary group with this name already exists
      console.log(
        `   🔍 Step 1: Checking if secondary group "${secondaryGroupName}" already exists...`
      );
      const existingGroupId = await searchGroupByName(secondaryGroupName);

      if (existingGroupId) {
        console.log(
          `   ✅ Secondary group already exists with ID: ${existingGroupId} - will use existing group`
        );
        return { groupId: existingGroupId, created: false };
      }

      // Secondary group doesn't exist, so create it
      console.log(`   📝 Step 2: Secondary group does not exist, creating new group...`);

      // Build secondary group payload based on dossier specifications
      const groupPayload = {
        name: secondaryGroupName,
        company_name: secondaryGroupName,
        address_1: "",
        logo: null,
        contact_email: "",
        contact_name: secondaryGroupName,
        city: "",
        country: "Mexico", // Default as specified in dossier
      };

      console.log(`   Secondary group payload:`, JSON.stringify(groupPayload, null, 2));

      const response = await pegasus.apiPost(
        "create-secondary-group",
        "/groups",
        groupPayload,
        apiToken(),
        30000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pegasus API call failed: ${response.status} - ${errorText}`);
      }

      const groupData = await response.json();
      console.log(`   Secondary group creation response:`, JSON.stringify(groupData, null, 2));

      // Extract group ID from response
      const groupId = groupData.id || groupData._id;
      if (!groupId) {
        throw new Error("No secondary group ID returned from Pegasus");
      }

      console.log(`   ✅ Secondary group created successfully with ID: ${groupId}`);
      return { groupId, created: true };
    } catch (error) {
      console.error(`   ❌ Fatal error in secondary group operation: ${error.message}`);
      throw error;
    }
  }

  return { createOrUpdateGroup, createOrUpdateSecondaryGroup };
}

module.exports = { createGroupHelpers };
