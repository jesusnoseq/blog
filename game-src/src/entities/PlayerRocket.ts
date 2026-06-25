import { Rocket } from './Rocket';

/**
 * PlayerRocket — the human-controlled rocket.
 *
 * Currently just a semantic subclass of {@link Rocket}; it exists to anchor the
 * `Rocket → PlayerRocket / AIRocket` hierarchy and is the extension point for
 * player-specific state (fuel, side-thruster combat cone) in later milestones.
 */
export class PlayerRocket extends Rocket {}
