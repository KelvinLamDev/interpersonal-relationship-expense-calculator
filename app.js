const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      newPersonName: "",
      people: [],
      groupName: "",
      groupLeaderId: null,
      groupMemberIds: [],
      groups: [],
      expenseDesc: "",
      amount: 0,
      splitAmong: [],
      expenses: [],
      settlements: [],
      calculated: false,
      nextId: 1,
      showCalculator: false,
      calcDisplay: "",
      precision: 2,
      hasScenarioData: false,
      shareUrl: "",
      copyBtnText: "複製",
      activePayerId: null,
      canNativeShare: false,
      editingExpenseIndex: null,

      // History & Records
      historyPeople: [],
      teamRecords: [],
      showTeamRecordsModal: false,
    };
  },
  mounted() {
    this.canNativeShare =
      typeof navigator !== "undefined" && !!navigator.share;
    this.hasScenarioData = !!(
      typeof SCENARIO_DATA !== "undefined" && SCENARIO_DATA
    );

    // Load History
    try {
      const hp = localStorage.getItem("ncs_history_people");
      if (hp) this.historyPeople = JSON.parse(hp);

      const recs = localStorage.getItem("ncs_team_records");
      if (recs) this.teamRecords = JSON.parse(recs);
    } catch (e) {
      console.error("History load error", e);
    }

    this.loadFromUrl();
  },
  computed: {
    suggestedPeople() {
      return this.historyPeople
        .filter((name) => !this.people.some((p) => p.name === name))
        .slice(0, 10);
    },
    canCreateGroup() {
      return this.groupLeaderId && this.groupMemberIds.length > 0;
    },
    isValidExpense() {
      return (
        this.expenseDesc &&
        this.activePayerId &&
        this.amount > 0 &&
        this.splitAmong.length > 0
      );
    },

    leaderIds() {
      return new Set(this.groups.map((g) => g.leaderId));
    },

    personStats() {
      let stats = {};
      this.people.forEach(
        (p) => (stats[p.id] = { paid: 0, share: 0, net: 0 })
      );
      this.expenses.forEach((exp) => {
        if (stats[exp.payerId]) stats[exp.payerId].paid += exp.amount;
        if (exp.splitIds.length > 0) {
          const share = exp.amount / exp.splitIds.length;
          exp.splitIds.forEach((sid) => {
            if (stats[sid]) stats[sid].share += share;
          });
        }
      });

      // 計算淨額
      for (let id in stats) {
        stats[id].net = stats[id].paid - stats[id].share;
      }

      return stats;
    },

    generatedConnections() {
      let conns = [];
      this.groups.forEach((g) => {
        g.memberIds.forEach((mid) => {
          conns.push({ a: g.leaderId, b: mid });
        });
      });
      return conns;
    },
  },
  methods: {
    formatMoney(val) {
      if (typeof val !== "number") return "0";
      return val.toFixed(this.precision);
    },
    getMultiplier() {
      return Math.pow(10, this.precision);
    },

    addPerson() {
      if (!this.newPersonName.trim()) return;
      const name = this.newPersonName.trim();
      this.people.push({
        id: this.nextId++,
        name: name,
      });

      // Add to history (Case Insensitive Check)
      const nameLower = name.toLowerCase();
      const exists = this.historyPeople.some(
        (h) => h.toLowerCase() === nameLower
      );

      if (!exists) {
        this.historyPeople.unshift(name);
        if (this.historyPeople.length > 20) this.historyPeople.pop();
        localStorage.setItem(
          "ncs_history_people",
          JSON.stringify(this.historyPeople)
        );
      }

      this.newPersonName = "";
    },
    addHistoryPerson(name) {
      this.people.push({
        id: this.nextId++,
        name: name,
      });
    },
    removePerson(id) {
      if (this.activePayerId === id) this.activePayerId = null;
      this.people = this.people.filter((p) => p.id !== id);
      this.groups = this.groups.filter((g) => g.leaderId !== id);
      this.groups.forEach((g) => {
        g.memberIds = g.memberIds.filter((mid) => mid !== id);
      });
      this.groups = this.groups.filter((g) => g.memberIds.length > 0);
      this.expenses = [];
      this.settlements = [];
      this.calculated = false;
    },
    getPersonName(id) {
      return this.people.find((p) => p.id === id)?.name || "未知";
    },

    getPersonExpenses(personId) {
      return this.expenses
        .map((e, i) => ({ ...e, originalIndex: i }))
        .filter((e) => e.payerId === personId);
    },

    isLeader(id) {
      return this.leaderIds.has(id);
    },

    getDisplayName(id) {
      const name = this.getPersonName(id);
      return this.isLeader(id) ? `👑 ${name}` : name;
    },

    createGroup() {
      if (!this.canCreateGroup) return;
      
      this.groups.push({
        name: this.groupName,
        leaderId: this.groupLeaderId,
        memberIds: [...this.groupMemberIds],
      });
      this.groupName = "";
      this.groupLeaderId = null;
      this.groupMemberIds = [];
    },

    saveTeamRecord() {
      if (this.people.length === 0) return;

      const record = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        peopleNames: this.people.map((p) => p.name),
        groupsData: this.groups.map((g) => ({
          name: g.name,
          leaderName: this.getPersonName(g.leaderId),
          memberNames: g.memberIds.map((mid) => this.getPersonName(mid)),
        })),
      };

      // Avoid duplicates (Structure based)
      const recordStr = JSON.stringify({
        p: record.peopleNames.sort(),
        g: record.groupsData,
      });
      const isDuplicate = this.teamRecords.some((r) => {
        const exStr = JSON.stringify({
          p: r.peopleNames.sort(),
          g: r.groupsData,
        });
        return exStr === recordStr;
      });

      if (isDuplicate) return;

      this.teamRecords.unshift(record);
      if (this.teamRecords.length > 20) this.teamRecords.pop();
      localStorage.setItem(
        "ncs_team_records",
        JSON.stringify(this.teamRecords)
      );
    },

    loadTeamRecord(rec) {
      if (this.people.length > 0) {
        if (!confirm("確定要載入此組合嗎？當前人員和圈子將被覆蓋。"))
          return;
      }

      // Clear current
      this.people = [];
      this.groups = [];
      this.expenses = [];
      this.settlements = [];
      this.calculated = false;
      this.nextId = 1;

      // Load People
      rec.peopleNames.forEach((name) => {
        this.people.push({
          id: this.nextId++,
          name: name,
        });
      });

      // Load Groups (Reconstruct logical connections)
      if (rec.groupsData) {
        rec.groupsData.forEach((gData) => {
          const leader = this.people.find(
            (p) => p.name === gData.leaderName
          );
          if (!leader) return;

          const memberIds = [];
          gData.memberNames.forEach((mName) => {
            const m = this.people.find((p) => p.name === mName);
            if (m) memberIds.push(m.id);
          });

          if (memberIds.length > 0) {
            this.groups.push({
              name: gData.name,
              leaderId: leader.id,
              memberIds: memberIds,
            });
          }
        });
      }
    },

    deleteTeamRecord(index) {
      this.teamRecords.splice(index, 1);
      localStorage.setItem(
        "ncs_team_records",
        JSON.stringify(this.teamRecords)
      );
    },

    removeGroup(idx) {
      this.groups.splice(idx, 1);
    },

    openExpenseForm(personId) {
      if (this.activePayerId === personId) {
        if (this.editingExpenseIndex === null) {
          // If opening normal add form and already open, close it
          this.activePayerId = null;
          return;
        }
        // If switching from edit to add on same person, just reset
      }
      this.activePayerId = personId;
      this.editingExpenseIndex = null;
      this.expenseDesc = "";
      this.amount = 0;
      this.splitAmong = this.people.map((p) => p.id);
      this.showCalculator = false;
    },

    editExpense(originalIdx) {
      const exp = this.expenses[originalIdx];
      if (!exp) return;

      // Set active payer to open the accordion
      this.activePayerId = exp.payerId;
      this.editingExpenseIndex = originalIdx;

      // Fill form data
      this.expenseDesc = exp.desc;
      this.amount = exp.amount;
      this.splitAmong = [...exp.splitIds];
      this.showCalculator = false;
    },

    cancelEdit() {
      this.activePayerId = null;
      this.editingExpenseIndex = null;
      this.expenseDesc = "";
      this.amount = 0;
    },

    saveExpense() {
      if (!this.isValidExpense) return;

      if (this.editingExpenseIndex !== null) {
        // Update existing
        this.expenses[this.editingExpenseIndex] = {
          ...this.expenses[this.editingExpenseIndex],
          desc: this.expenseDesc,
          payerId: this.activePayerId,
          amount: this.amount,
          splitIds: [...this.splitAmong],
        };
        this.editingExpenseIndex = null;
      } else {
        // Create new
        this.expenses.push({
          desc: this.expenseDesc,
          payerId: this.activePayerId,
          amount: this.amount,
          splitIds: [...this.splitAmong],
          showDetails: false,
        });
      }

      // Reset form but keep accordion open for continuous entry if adding
      // If editing, close it
      if (this.editingExpenseIndex === null) {
        this.activePayerId = null;
      }

      this.expenseDesc = "";
      this.amount = 0;
      // this.activePayerId = null; // Removed to allow feedback or better UX
    },

    // 修正：刪除需使用原始 Index
    removeExpense(originalIdx) {
      this.expenses.splice(originalIdx, 1);
    },
    // 修正：Toggle 需使用原始 Index
    toggleExpenseDetails(originalIdx) {
      this.expenses[originalIdx].showDetails =
        !this.expenses[originalIdx].showDetails;
    },

    toggleCalculator() {
      this.showCalculator = !this.showCalculator;
      if (this.showCalculator) {
        this.calcDisplay = this.amount > 0 ? this.amount.toString() : "";
      }
    },
    closeCalcOutside() {
      this.showCalculator = false;
    },
    calcAppend(char) {
      const last = this.calcDisplay.slice(-1);
      if (
        ["+", "-", "*", "/", "."].includes(char) &&
        ["+", "-", "*", "/", "."].includes(last)
      )
        return;
      this.calcDisplay += char;
    },
    calcClear() {
      this.calcDisplay = "";
    },
    calcBackspace() {
      this.calcDisplay = this.calcDisplay.slice(0, -1);
    },
    calcResult() {
      try {
        if (!this.calcDisplay) return;
        const sanitized = this.calcDisplay.replace(/[^0-9+\-*/.]/g, "");
        const result = new Function("return " + sanitized)();
        const m = this.getMultiplier();
        this.amount = Math.round(result * m) / m;
        this.showCalculator = false;
      } catch (e) {
        this.calcDisplay = "Error";
        setTimeout(() => (this.calcDisplay = ""), 1000);
      }
    },

    calculateSettlement(save = true) {
      this.settlements = [];
      this.calculated = true;
      if (this.people.length === 0) return;

      // Save Team Record (People + Groups only)
      if (save) {
        this.saveTeamRecord();
      }

      const m = this.getMultiplier();
      const epsilon = this.precision === 1 ? 0.09 : 0.009;

      let balances = {};
      this.people.forEach((p) => (balances[p.id] = 0));
      this.expenses.forEach((exp) => {
        const splitCount = exp.splitIds.length;
        const share = exp.amount / splitCount;
        balances[exp.payerId] += exp.amount;
        exp.splitIds.forEach((id) => (balances[id] -= share));
      });
      for (let id in balances)
        balances[id] = Math.round(balances[id] * m) / m;

      let currentConnections = this.generatedConnections;
      let adj = {};
      this.people.forEach((p) => (adj[p.id] = []));
      currentConnections.forEach((c) => {
        adj[c.a].push(c.b);
        adj[c.b].push(c.a);
      });

      let visited = new Set();
      let islandRepresentatives = [];

      for (let person of this.people) {
        if (!visited.has(person.id)) {
          let componentNodes = [];
          let q = [person.id];
          visited.add(person.id);
          while (q.length > 0) {
            let curr = q.shift();
            componentNodes.push(curr);
            for (let n of adj[curr]) {
              if (!visited.has(n)) {
                visited.add(n);
                q.push(n);
              }
            }
          }

          let representativeId = this.solveIslandInternal(
            componentNodes,
            adj,
            balances,
            currentConnections,
            epsilon,
            m
          );

          if (Math.abs(balances[representativeId]) > epsilon) {
            islandRepresentatives.push({
              id: representativeId,
              val: balances[representativeId],
            });
          }
        }
      }
      this.solveGlobalDebts(islandRepresentatives, epsilon);
      this.generateShareLink();
    },

    solveIslandInternal(nodes, adj, balances, connections, epsilon, m) {
      if (nodes.length < 2) return nodes[0];

      let scores = {};
      nodes.forEach((n) => (scores[n] = 0));
      connections.forEach((c) => {
        if (nodes.includes(c.a) && nodes.includes(c.b)) {
          scores[c.a] += 10;
          scores[c.b] += 1;
        }
      });
      let root = nodes.sort((a, b) => {
        let scoreDiff = scores[b] - scores[a];
        if (scoreDiff !== 0) return scoreDiff;
        return balances[b] - balances[a];
      })[0];

      let isGroupCircle = scores[root] >= 10;

      if (isGroupCircle) {
        let members = nodes.filter((n) => n !== root);
        let debtors = members
          .filter((n) => balances[n] < -epsilon)
          .sort((a, b) => balances[a] - balances[b]);
        let creditors = members
          .filter((n) => balances[n] > epsilon)
          .sort((a, b) => balances[b] - balances[a]);

        let i = 0,
          j = 0;
        while (i < debtors.length && j < creditors.length) {
          let debtor = debtors[i];
          let creditor = creditors[j];

          let amount = Math.min(
            Math.abs(balances[debtor]),
            balances[creditor]
          );
          amount = Math.round(amount * m) / m;

          if (amount > 0) {
            this.settlements.push({
              fromId: debtor,
              toId: creditor,
              amount: amount,
              type: "local",
            });
            balances[debtor] += amount;
            balances[creditor] -= amount;
            balances[debtor] = Math.round(balances[debtor] * m) / m;
            balances[creditor] = Math.round(balances[creditor] * m) / m;
          }

          if (Math.abs(balances[debtor]) < epsilon) i++;
          if (Math.abs(balances[creditor]) < epsilon) j++;
        }

        members.forEach((member) => {
          if (Math.abs(balances[member]) > epsilon) {
            let amt = Math.abs(balances[member]);
            if (balances[member] < 0) {
              this.settlements.push({
                fromId: member,
                toId: root,
                amount: amt,
                type: "local",
              });
            } else {
              this.settlements.push({
                fromId: root,
                toId: member,
                amount: amt,
                type: "local",
              });
            }
            balances[root] += balances[member];
            balances[root] = Math.round(balances[root] * m) / m;
            balances[member] = 0;
          }
        });
      } else {
        let parentMap = {};
        let q = [root];
        let treeVisited = new Set([root]);
        let bfsOrder = [];
        while (q.length) {
          let u = q.shift();
          bfsOrder.push(u);
          for (let v of adj[u]) {
            if (nodes.includes(v) && !treeVisited.has(v)) {
              treeVisited.add(v);
              parentMap[v] = u;
              q.push(v);
            }
          }
        }
        for (let i = bfsOrder.length - 1; i >= 0; i--) {
          let u = bfsOrder[i];
          if (u === root) continue;
          let bal = balances[u];
          let parent = parentMap[u];
          if (Math.abs(bal) > epsilon) {
            if (bal < 0) {
              this.settlements.push({
                fromId: u,
                toId: parent,
                amount: Math.abs(bal),
                type: "local",
              });
            } else {
              this.settlements.push({
                fromId: parent,
                toId: u,
                amount: bal,
                type: "local",
              });
            }
            balances[parent] += bal;
            balances[parent] = Math.round(balances[parent] * m) / m;
            balances[u] = 0;
          }
        }
      }

      return root;
    },

    solveGlobalDebts(participants, epsilon) {
      let debtors = participants
        .filter((p) => p.val < -epsilon)
        .sort((a, b) => a.val - b.val);
      let creditors = participants
        .filter((p) => p.val > epsilon)
        .sort((a, b) => b.val - a.val);
      let i = 0,
        j = 0;
      while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i];
        let creditor = creditors[j];
        let amount = Math.min(Math.abs(debtor.val), creditor.val);

        this.settlements.push({
          fromId: debtor.id,
          toId: creditor.id,
          amount: amount,
          type: "global",
        });
        debtor.val += amount;
        creditor.val -= amount;
        if (Math.abs(debtor.val) < epsilon) i++;
        if (Math.abs(creditor.val) < epsilon) j++;
      }
    },

    generateShareLink() {
      try {
        // Minify data structure to reduce size
        // p: people [name], g: groups [name, leaderIdx, [memberIndices]], e: expenses [desc, payerIdx, amount, [splitIndices]]

        // Create ID to Index map (1-based)
        const idMap = {};
        this.people.forEach((p, i) => {
          idMap[p.id] = i + 1;
        });

        const minData = {
          p: this.people.map((p) => p.name),
          g: this.groups.map((g) => [
            g.name,
            idMap[g.leaderId],
            g.memberIds.map((mid) => idMap[mid]),
          ]),
          e: this.expenses.map((exp) => [
            exp.desc,
            idMap[exp.payerId],
            exp.amount,
            exp.splitIds.map((sid) => idMap[sid]),
          ]),
        };

        const json = JSON.stringify(minData);
        // Use LZString for compression
        const compressed = LZString.compressToEncodedURIComponent(json);

        const url = new URL(window.location.href);
        url.searchParams.set("d", compressed); // Use 'd' for compressed data
        this.shareUrl = url.toString();
        this.copyBtnText = "複製";
      } catch (e) {
        console.error("Error generating link", e);
      }
    },

    copyShareLink() {
      if (!this.shareUrl) return;
      navigator.clipboard.writeText(this.shareUrl).then(() => {
        this.copyBtnText = "已複製!";
        setTimeout(() => (this.copyBtnText = "複製"), 2000);
      });
    },

    nativeShare() {
      if (navigator.share) {
        navigator
          .share({
            title: "分帳計算結果",
            text: "這是我們的分帳計算結果，請查看：",
            url: this.shareUrl,
          })
          .catch((error) => console.log("Error sharing", error));
      } else {
        alert("您的瀏覽器不支援原生分享功能，請使用複製連結。");
      }
    },

    loadFromUrl() {
      const params = new URLSearchParams(window.location.search);

      // Try loading compressed data first ('d')
      const compressed = params.get("d");
      if (compressed) {
        try {
          const json =
            LZString.decompressFromEncodedURIComponent(compressed);
          const minData = JSON.parse(json);

          if (minData.p) {
            // Reconstruct People
            this.people = minData.p.map((name, i) => ({
              id: i + 1,
              name: name,
            }));

            // Index to ID map (1-based index -> ID)
            // Since we just assigned IDs 1..N, index i corresponds to ID i+1

            // Reconstruct Groups
            if (minData.g) {
              this.groups = minData.g.map((g) => ({
                name: g[0],
                leaderId: g[1], // Index is same as ID in this reconstruction
                memberIds: g[2],
              }));
            }

            // Reconstruct Expenses
            if (minData.e) {
              this.expenses = minData.e.map((e) => ({
                desc: e[0],
                payerId: e[1],
                amount: e[2],
                splitIds: e[3],
                showDetails: false,
              }));
            }
          }

          this.finishLoading();
          return;
        } catch (e) {
          console.error("Error loading compressed data", e);
        }
      }

      // Fallback to legacy base64 data ('data')
      const base64 = params.get("data");
      if (base64) {
        try {
          // UTF-8 safe decoding
          const json = decodeURIComponent(
            atob(base64)
              .split("")
              .map(function (c) {
                return (
                  "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                );
              })
              .join("")
          );
          const data = JSON.parse(json);

          if (data.people) this.people = data.people;
          if (data.groups) this.groups = data.groups;
          if (data.expenses) this.expenses = data.expenses;

          this.finishLoading();
        } catch (e) {
          console.error("Error loading data from URL", e);
          alert("無法載入分享的資料，連結可能已損壞。");
        }
      }
    },

    finishLoading() {
      // Update nextId to avoid conflicts
      if (this.people.length > 0) {
        this.nextId = Math.max(...this.people.map((p) => p.id)) + 1;
      }

      this.$nextTick(() => {
        this.calculateSettlement();
        // Clean URL without reloading
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      });
    },

    loadUserScenario() {
      if (window.SCENARIO_DATA) {
        // Deep copy to ensure fresh data on each load
        this.people = JSON.parse(
          JSON.stringify(window.SCENARIO_DATA.people)
        );
        this.groups = JSON.parse(
          JSON.stringify(window.SCENARIO_DATA.groups)
        );
        this.expenses = JSON.parse(
          JSON.stringify(window.SCENARIO_DATA.expenses)
        );
        this.$nextTick(() => {
          this.calculateSettlement();
        });
      } else {
        alert("Scenario data not found!");
      }
    },

    clearAllData() {
      if (!confirm("確定要清空所有資料嗎？此動作無法復原。")) return;
      this.people = [];
      this.groups = [];
      this.expenses = [];
      this.settlements = [];
      this.calculated = false;
      this.nextId = 1;
      this.shareUrl = "";
      this.activePayerId = null;
      this.expenseDesc = "";
      this.amount = 0;
      this.splitAmong = [];
      this.groupName = "";
      this.groupLeaderId = null;
      this.groupMemberIds = [];

      // Clear URL params
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    },
  },
});
app.mount("#app");