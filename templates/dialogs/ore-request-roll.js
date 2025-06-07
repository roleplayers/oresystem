/**
 * ORE Request Roll System
 * Handles group roll requests with individual player configuration
 */

export class ORERequestRoll {
  static ID = 'ore-request-roll';
  
  static FLAGS = {
    REQUEST_ID: 'requestId',
    PARTICIPANTS: 'participants',
    CONFIGURATIONS: 'configurations',
    STATUS: 'status',
    RESULTS: 'results'
  };

  static TEMPLATES = {
    REQUEST_DIALOG: 'systems/oresystem/templates/dialogs/request-roll-dialog.html',
    PLAYER_CARD: 'systems/oresystem/templates/chat/request-roll-player-card.html',
    RESULTS_CARD: 'systems/oresystem/templates/chat/request-roll-results.html'
  };

  /**
   * Initialize the request roll system
   */
  static init() {
    // Add button to chat controls
    Hooks.on('renderChatLog', (app, html) => {
      if (game.user.isGM) {
        const button = $(`<a class="button ore-request-roll" title="Request Group Roll">
          <i class="fas fa-dice-d20"></i> Request Roll
        </a>`);
        
        button.click(() => this.showRequestDialog());
        
        // Find the chat controls container
        const chatControls = html.find('.control-buttons');
        if (chatControls.length) {
          chatControls.prepend(button);
        }
      }
    });
    
    // Also add as a chat command
    Hooks.on('chatMessage', (html, content, msg) => {
      if (content.startsWith('/request-roll') && game.user.isGM) {
        this.showRequestDialog();
        return false;
      }
    });

    // Handle chat message rendering
    Hooks.on('renderChatMessage', (message, html) => {
      if (message.getFlag('oresystem', 'requestRoll')) {
        this.enhanceRequestMessage(message, html);
      }
    });
  }

  /**
   * Show the request dialog for GM
   */
  static async showRequestDialog() {
    const users = game.users.filter(u => u.active && !u.isGM);
    const actors = game.actors.filter(a => a.hasPlayerOwner);
    
    const content = await renderTemplate(this.TEMPLATES.REQUEST_DIALOG, {
      users,
      actors
    });

    new Dialog({
      title: "Request Group Roll",
      content,
      buttons: {
        request: {
          label: "Send Request",
          callback: (html) => this.createRequest(html)
        },
        cancel: {
          label: "Cancel"
        }
      },
      default: "request"
    }).render(true);
  }

  /**
   * Create a new roll request
   */
  static async createRequest(html) {
    const form = html[0];
    const selectedUsers = Array.from(form.querySelectorAll('input[name="user"]:checked'))
      .map(input => input.value);
    const selectedActors = Array.from(form.querySelectorAll('input[name="actor"]:checked'))
      .map(input => input.value);
    
    if (selectedUsers.length === 0 && selectedActors.length === 0) {
      ui.notifications.warn("Please select at least one participant");
      return;
    }

    const requestId = foundry.utils.randomID();
    const participants = this.buildParticipantsList(selectedUsers, selectedActors);
    
    // Create the request message
    const messageData = {
      content: await this.renderRequestMessage(requestId, participants),
      flags: {
        oresystem: {
          requestRoll: true,
          [this.FLAGS.REQUEST_ID]: requestId,
          [this.FLAGS.PARTICIPANTS]: participants,
          [this.FLAGS.CONFIGURATIONS]: {},
          [this.FLAGS.STATUS]: 'configuring',
          [this.FLAGS.RESULTS]: {}
        }
      }
    };

    await ChatMessage.create(messageData);
  }

  /**
   * Build participants list from selected users and actors
   */
  static buildParticipantsList(userIds, actorIds) {
    const participants = {};
    
    // Add users with their primary actors
    userIds.forEach(userId => {
      const user = game.users.get(userId);
      if (user) {
        participants[userId] = {
          type: 'user',
          name: user.name,
          actorId: user.character?.id,
          configured: false,
          rolled: false
        };
      }
    });
    
    // Add specific actors
    actorIds.forEach(actorId => {
      const actor = game.actors.get(actorId);
      if (actor) {
        const owner = game.users.find(u => actor.testUserPermission(u, "OWNER") && !u.isGM);
        if (owner && !participants[owner.id]) {
          participants[owner.id] = {
            type: 'actor',
            name: actor.name,
            actorId: actorId,
            configured: false,
            rolled: false
          };
        }
      }
    });
    
    return participants;
  }

  /**
   * Render the request message
   */
  static async renderRequestMessage(requestId, participants) {
    const participantList = Object.entries(participants).map(([userId, data]) => ({
      userId,
      ...data,
      isCurrentUser: userId === game.user.id
    }));

    return await renderTemplate(this.TEMPLATES.PLAYER_CARD, {
      requestId,
      participants: participantList,
      isGM: game.user.isGM
    });
  }

  /**
   * Enhance request messages with interactivity
   */
  static enhanceRequestMessage(message, html) {
    const requestId = message.getFlag('oresystem', this.FLAGS.REQUEST_ID);
    const participants = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS);
    const status = message.getFlag('oresystem', this.FLAGS.STATUS);
    
    // Add event listeners for configuration
    if (status === 'configuring') {
      html.find('.ore-configure-roll').click(async (event) => {
        const userId = event.currentTarget.dataset.userId;
        if (userId === game.user.id || game.user.isGM) {
          await this.showConfigurationDialog(message, userId);
        }
      });
    }
    
    // Add event listeners for rolling
    if (status === 'ready') {
      html.find('.ore-execute-roll').click(async (event) => {
        const userId = event.currentTarget.dataset.userId;
        if (userId === game.user.id || game.user.isGM) {
          await this.executeRoll(message, userId);
        }
      });
    }
    
    // GM controls
    if (game.user.isGM) {
      html.find('.ore-unlock-rolls').click(() => this.unlockRolls(message));
      html.find('.ore-show-results').click(() => this.showResults(message));
    }
  }

  /**
   * Show configuration dialog for a participant
   */
  static async showConfigurationDialog(message, userId) {
    const participant = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS)[userId];
    const actor = game.actors.get(participant.actorId);
    
    if (!actor) {
      ui.notifications.error("Actor not found");
      return;
    }

    // Get stats and skills
    const stats = actor.items.filter(i => i.type === 'stat');
    const skills = actor.items.filter(i => i.type === 'skill');
    
    const content = `
      <form>
        <div class="form-group">
          <label>Stat</label>
          <select name="stat">
            ${stats.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Skill</label>
          <select name="skill">
            <option value="">None</option>
            ${skills.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Penalty</label>
          <input type="number" name="penalty" value="0" min="0" max="10">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" name="multiAction"> Multi-Action
          </label>
        </div>
      </form>
    `;

    new Dialog({
      title: `Configure Roll - ${participant.name}`,
      content,
      buttons: {
        submit: {
          label: "Submit",
          callback: (html) => this.saveConfiguration(message, userId, html)
        },
        cancel: {
          label: "Cancel"
        }
      },
      default: "submit"
    }).render(true);
  }

  /**
   * Save roll configuration
   */
  static async saveConfiguration(message, userId, html) {
    const form = html[0];
    const config = {
      statId: form.querySelector('[name="stat"]').value,
      skillId: form.querySelector('[name="skill"]').value,
      penalty: parseInt(form.querySelector('[name="penalty"]').value) || 0,
      description: form.querySelector('[name="description"]').value,
      multiAction: form.querySelector('[name="multiAction"]').checked
    };

    // Update message flags
    const updates = {
      [`flags.oresystem.${this.FLAGS.CONFIGURATIONS}.${userId}`]: config,
      [`flags.oresystem.${this.FLAGS.PARTICIPANTS}.${userId}.configured`]: true
    };

    await message.update(updates);
    
    // Check if all participants have configured
    const participants = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS);
    const allConfigured = Object.values(participants).every(p => p.configured);
    
    if (allConfigured && game.user.isGM) {
      ui.notifications.info("All participants have configured their rolls. You can now unlock rolling.");
    }
  }

  /**
   * Unlock rolls for all participants
   */
  static async unlockRolls(message) {
    await message.update({
      [`flags.oresystem.${this.FLAGS.STATUS}`]: 'ready'
    });
    
    ui.notifications.info("Rolls unlocked! Players can now roll.");
  }

  /**
   * Execute a roll for a participant
   */
  static async executeRoll(message, userId) {
    const participant = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS)[userId];
    const config = message.getFlag('oresystem', this.FLAGS.CONFIGURATIONS)[userId];
    const actor = game.actors.get(participant.actorId);
    
    if (!actor || !config) {
      ui.notifications.error("Missing configuration");
      return;
    }

    // Build the roll command
    const stat = actor.items.get(config.statId);
    const skill = config.skillId ? actor.items.get(config.skillId) : null;
    
    let totalD = stat.system.d || 0;
    let totalED = stat.system.ed || 0;
    let totalMD = stat.system.md || 0;
    
    if (skill) {
      totalD += skill.system.d || 0;
      totalED += skill.system.ed || 0;
      totalMD += skill.system.md || 0;
    }

    const rollCommand = `/ore ${totalD}d ${totalED}e10 dif 0 pen ${config.penalty} md ${totalMD} # ${config.description || 'Request Roll'}`;
    
    // Execute the roll
    const roll = await game.oneRollEngine.rollFromChatMessageOreCommand(rollCommand, {
      content: '',
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rolls: [],
      flags: { core: { canPopout: true } }
    });

    // Store the result
    const updates = {
      [`flags.oresystem.${this.FLAGS.RESULTS}.${userId}`]: roll,
      [`flags.oresystem.${this.FLAGS.PARTICIPANTS}.${userId}.rolled`]: true
    };

    await message.update(updates);
    
    // Check if all have rolled
    const participants = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS);
    const allRolled = Object.values(participants).every(p => p.rolled);
    
    if (allRolled) {
      await this.showResults(message);
    }
  }

  /**
   * Show consolidated results
   */
  static async showResults(message) {
    const results = message.getFlag('oresystem', this.FLAGS.RESULTS);
    const participants = message.getFlag('oresystem', this.FLAGS.PARTICIPANTS);
    
    // Process and sort results
    const processedResults = Object.entries(results).map(([userId, result]) => {
      const participant = participants[userId];
      const maxWidth = Math.max(...result.sets.map(s => s.width), 0);
      
      return {
        userId,
        name: participant.name,
        result,
        maxWidth
      };
    }).sort((a, b) => b.maxWidth - a.maxWidth);

    // Create results message
    const content = await renderTemplate(this.TEMPLATES.RESULTS_CARD, {
      results: processedResults
    });

    await ChatMessage.create({ content });
  }
}

// Initialize on ready
Hooks.once('ready', () => {
  ORERequestRoll.init();
  
  // Make it globally accessible
  game.oresystem = game.oresystem || {};
  game.oresystem.ORERequestRoll = ORERequestRoll;
});