class HideGMRolls {
	static init() {
		game.settings.register('hide-gm-rolls', 'sanitize-rolls', {
			name: game.i18n.localize('hide-gm-rolls.settings.sanitize-rolls.name'),
			hint: game.i18n.localize('hide-gm-rolls.settings.sanitize-rolls.hint'),
			scope: 'world',
			config: true,
			restricted: true,
			default: true,
			type: Boolean,
		});

		game.settings.register('hide-gm-rolls', 'sanitize-dice-so-nice', {
			name: game.i18n.localize('hide-gm-rolls.settings.sanitize-dice-so-nice.name'),
			hint: game.i18n.localize('hide-gm-rolls.settings.sanitize-dice-so-nice.hint'),
			scope: 'world',
			config: true,
			restricted: true,
			default: true,
			type: Boolean,
		});

		game.settings.register('hide-gm-rolls', 'hide-private-rolls', {
			name: game.i18n.localize('hide-gm-rolls.settings.hide-private-rolls.name'),
			hint: game.i18n.localize('hide-gm-rolls.settings.hide-private-rolls.hint'),
			scope: 'world',
			config: true,
			restricted: true,
			default: true,
			type: Boolean,
		});

		game.settings.register('hide-gm-rolls', 'hide-player-rolls', {
			name: game.i18n.localize('hide-gm-rolls.settings.hide-player-rolls.name'),
			hint: game.i18n.localize('hide-gm-rolls.settings.hide-player-rolls.hint'),
			scope: 'world',
			config: true,
			restricted: true,
			default: false,
			type: Boolean,
		});

		game.settings.register('hide-gm-rolls', 'private-hidden-tokens', {
			name: game.i18n.localize('hide-gm-rolls.settings.private-hidden-tokens.name'),
			hint: game.i18n.localize('hide-gm-rolls.settings.private-hidden-tokens.hint'),
			scope: 'world',
			config: true,
			restricted: true,
			default: false,
			type: Boolean,
		});
	}

	static ready() {
		if (!game.modules.get('lib-wrapper')?.active) {
			if (game.user.isGM) {
				ui.notifications.error(
					"Module hide-gm-rolls requires the 'lib-wrapper' module. Please install and activate it.",
				);
			}
			return;
		}

		libWrapper.register(
			'hide-gm-rolls',
			'ChatLog.prototype.notify',
			(wrapped, ...args) => {
				if (args.length < 1) {
					wrapped(...args);
					return;
				}
				if (this.shouldHide(args[0])) {
					return;
				}
				wrapped(...args);
			},
			'MIXED',
		);
	}

	static isGMMessage(msg) {
		return game.user.isGM || (msg.author && !msg.author.isGM) || (!msg.author && !msg.user?.isGM);
	}

	static isPlayerMessage(msg) {
		return msg.author?.id === game.user.id || (!msg.author && msg.user?.id == game.user.id);
	}

	static shouldHide(msg) {
		if (
			!game.settings.get('hide-gm-rolls', 'hide-private-rolls') &&
			!game.settings.get('hide-gm-rolls', 'hide-player-rolls')
		)
			return false;

		// Skip if we have an empty msg
		if (!msg) {
			return false;
		}

		// Skip processing if we're a GM, or the message did not originate from one.
		if (this.isGMMessage(msg) && !game.settings.get('hide-gm-rolls', 'hide-player-rolls')) {
			return false;
		}

		const whisper = msg.whisper || msg.message?.whisper || msg.data?.whisper || msg.message?.data?.whisper;
		// Skip if this message is not a whisper
		if (!whisper) {
			return false;
		}
		// Skip if message was whispered to the current user.
		if (whisper.length === 0 || whisper.includes(game.user.id || game.user._id)) {
			return false;
		}

		// Skip if this player originated the message
		if (game.settings.get('hide-gm-rolls', 'hide-player-rolls') && this.isPlayerMessage(msg)) {
			return false;
		}

		return true;
	}

	static hideRoll(app, html, msg) {
		if (!this.shouldHide(msg)) {
			return;
		}


		if (isNewerVersion(game.version, "10")) {
			if (app.sound) {
				app.sound = null;
			}
		} else {
			if (app.data?.sound) {
				app.data.sound = null;
			}
		}
		html.addClass('gm-roll-hidden');
		html.hide();
	}

	static sanitizeRoll(html, msg) {
		if (!game.settings.get('hide-gm-rolls', 'sanitize-rolls')) return;

		// Skip processing if we're a GM, or the message did not originate from one.
		if (this.isGMMessage(msg)) {
			return;
		}
		const rollMessage = html.find('div.roll-message');
		const rollDetails = html.find('div.roll-message .roll-result div:nth-child(2) .aside');
		if (rollMessage && rollDetails) {
			rollMessage.html('<div class="roll-result">' + rollDetails.html() + '</div>');
		}
	}

	static mangleRoll(doc) {
		if (game.settings.get('hide-gm-rolls', 'private-hidden-tokens')) {
			// Skip processing unless we're a GM
			if (!game.user?.isGM) {
				return;
			}
			// Skip processing if the roll is already private
			const whisper = doc.whisper || doc.data?.whisper;
			if (whisper && whisper.length > 0) {
				return;
			}

			let tokenId;
			if (isNewerVersion(game.version, "10")) {
				tokenId = doc.speaker?.token;
			} else {
				tokenId = doc.data?.speaker?.token;
			}
			if (tokenId) {
				const token = game.canvas.tokens.get(tokenId);
				if (token?.document?.hidden) {
					doc.applyRollMode(CONST.DICE_ROLL_MODES.PRIVATE);
				}
			}
		}
	}
}

Hooks.on('init', () => {
	HideGMRolls.init();
});

Hooks.on('ready', () => {
	HideGMRolls.ready();
});

Hooks.on('preCreateChatMessage', (doc, _data, _options) => {
	HideGMRolls.mangleRoll(doc)
});

Hooks.on('renderChatMessage', (app, html, msg) => {
	HideGMRolls.hideRoll(app, html, msg);
	HideGMRolls.sanitizeRoll(html, msg);
});

Hooks.on('updateChatMessage', (msg, _data, _diff, id) => {
	if (!game.settings.get('hide-gm-rolls', 'sanitize-rolls')) {
		return;
	}

	const html = $(`li.message[data-message-id="${id}"]`);
	HideGMRolls.sanitizeRoll(html, msg);
});

Hooks.on('diceSoNiceRollStart', (_, context) => {
	if (game.settings.get('hide-gm-rolls', 'sanitize-dice-so-nice')) {
		// Skip processing if we're a GM, or the message did not originate from one.
		if (game.user.isGM || (context.user && !context.user.isGM)) {
			return true;
		}
		context.blind = true;
	}
});
