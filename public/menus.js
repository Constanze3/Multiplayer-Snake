let mainMenu;
let customizationMenu;

// Fires when site is loaded (Is only temporary here)
document.addEventListener('DOMContentLoaded', () => {
    mainMenu = new MainMenu("main-menu");
    customizationMenu = new CustomizationMenu("customization-menu");
});

// The Parent class for all menus, with a few generally useful functions
class Menu {
    constructor(containerClass) {
        this.containers = document.getElementsByClassName(containerClass);
        this.active = false;
    }

    // Shows or Hides the Menu
    setActive = (state) => {

        // Sets visible class of all menu container elements
        this.containers.forEach(element => {
            state ? element.classList.add("visible") : element.classList.remove("visible")
        });

        this.setActiveHelper(state);
    }

    // Helper to add more code to SetActive based on what the specific sub class needs
    setActiveHelper = (state) => { }
}

// The sidebar at the right side of the screen
class SideBar extends Menu {

}

// The main menu where you can join a room
class MainMenu extends Menu {
    constructor(containerClass) {
        super(containerClass);
    }

    displayError = (error) => {
        // !!! Should display error message in menu
    }
}

// The small menu that appears when joining a game
class LobbyMenu extends Menu {

}


// The customization menu where you can set all colors of the site
class CustomizationMenu extends Menu {

    constructor(containerClass) {
        super(containerClass);

        this.colorPicker = this.createColorPicker("#color-picker");
        this.buttons = document.getElementsByClassName("customization-option-button");

        this.selectedButton = null;

        //Set up onclick event for buttons
        this.buttons.forEach(button => { button.onclick = () => { this.buttonSelected(button.id) } });

        this.colorPicker.on('color:change', this.changeButtonColor);
    }

    // Overwrites the setActiveHelper of Menu class which will be executed on setActive(state)
    setActiveHelper = (state) => {
        if (state == false) {
            this.deselectCurrentButton();
        }
    }

    // Fires when a Button is Selected
    buttonSelected = (buttonId) => {
        if (this.selectedButton != null) this.deselectCurrentButton();
        this.selectedButton = document.getElementById(buttonId);
        this.selectedButton.classList.add("selected");
    }

    // Deselects Currently Selected Button
    deselectCurrentButton = () => {
        if (this.selectedButton == null) return;
        this.selectedButton.classList.remove("selected")
        this.selectedButton = null;
    }

    // Changes the color of the currently selected button
    changeButtonColor = (color) => {
        if (this.selectedButton == null) return;

        this.selectedButton.style.backgroundColor = color.hexString;

        this.selectedButton.style.setProperty("--dark-border", color.hexString);
        this.setButtonToLightOrDark(this.selectedButton, color.rgb);
    }

    // Sets a button's class to ligh or dark according to it's color value
    setButtonToLightOrDark(button, color) {
        let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

        if (luminance < 128) {
            button.classList.remove("light");
            button.classList.add("dark");
        }
        else {
            button.classList.remove("dark");
            button.classList.add("light");
        }
    }

    // Creates ColorPicker element using iro.js library
    createColorPicker = (elementId) =>
        new iro.ColorPicker(elementId, {
            width: 200,
            color: "rgb(255, 0, 0)",
            borderWidth: 1,
            borderColor: "#fff",
            layout: [
                {
                    component: iro.ui.Box,
                    options: {}
                },
                {
                    component: iro.ui.Slider,
                    options: {
                        sliderType: 'hue'
                    }
                }
            ]
        });
}