import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { ViewController } from 'ionic-angular';
import { AlertController } from 'ionic-angular';

import {GameService} from '../../providers/game-service';
import {TabsService} from '../../providers/tabs-service';

import { LoserPage } from '../loser/loser';
import { WinnerPage } from '../winner/winner';



@Component({
  selector: 'page-dashboard',
  templateUrl: 'dashboard.html',
  providers: [GameService, TabsService]

})
export class DashboardPage {
  public gameID:any;
  public test:any;
  public game:any = {};
  public players = [];
  public tasks = [];
  public hardships = [];
  public skipCounter:number;
  public completedCounter:number;
  objDate:any;
  public trailProgress: string = '0' + '%';
  public wagonProgress: string = '0' + '%';
  testRadioOpen: boolean;
  testRadioResult;
  taskAccepted: boolean;
  taskSkipped: boolean;
  activePlayer:any = {};
  activeTask:any;
  public currentHardship:any;
  public illPlayer:any;
  isHardship: boolean;
  menuIsHidden: boolean = false;


  constructor(public navCtrl: NavController, public navParams: NavParams, public gameService: GameService, public alertCtrl: AlertController, public tabs: TabsService, private view: ViewController) {
    this.gameID = navParams.get('id');
    this.objDate = Date.now();
    this.trailProgress = '0%'
    this.wagonProgress = '100%'
    this.skipCounter = 0;
    this.completedCounter = 0;
    this.taskSkipped = false;
  }

  ionViewWillEnter() {
      this.view.showBackButton(false);
     }

  ionViewDidLoad() {
    this.tabs.show()
    this.getGame()
    };

  getGame() {
    this.gameService.getGameDetails(this.gameID)
    .then(game => {
      this.game = game
      this.gameService.getPlayers(this.game.id)
      .then(data => {
        console.log('returning players')
       this.players = data.sort(this.compare);
      })
      .catch(err => {
        console.log(err)
      })
    }).catch(error => {
      console.log('could not get game details', error)
    }).then(() => {
      this.splitObject()
    }).catch(error => {
      console.log('splitObject', error)
    })
  }

  splitObject() {
    this.hardships = this.shuffleArray(this.game.goal.hardships)
    this.tasks = this.shuffleArray(this.game.goal.tasks)
  }

  assignTask(id) {
    if (this.isEligible(this.players) === false) {
      this.navCtrl.push(LoserPage, {
        game: this.game
      });
    }
    else {
      let taskID = id;
      let alert = this.alertCtrl.create();
      alert.setTitle('Assign Task To Player');
      this.players.forEach(element => {
      if (element.morale != 'Dead' && element.rest_count === 0) {
        alert.addInput({
          type: 'radio',
          label: element.trail_name,
          value: element.id
        })
      }
    })

    alert.addButton('Cancel');
    alert.addButton({
      text: 'Start',
      handler: data => {
        this.gameService.assignTask(data, taskID)
        .then(response => {
          this.testRadioOpen = false;
          this.gameService.getActivePlayer()
          .then(task => {
            this.activeTask = task;
            this.activePlayer = task[0].player
            this.taskAccepted = true;
          }).catch(err => {
            console.log(err)
          })
        }).catch(error => {
          console.log(error)
        })
      }
    });
    alert.present()
  }
}

  completeTask(status) {
    if (status === 'Completed') {
      this.completedCounter++
      this.decreaseRestCount()
      this.increaseMorale(this.activePlayer)
      this.asyncAwait()
    } else {
      this.skipCounter++
      if (this.skipCounter > 2) {
          this.assignPlayerToHardship()
      }
    }
    this.tasks.pop();
    if (this.tasks.length === 0) {
        this.reseedTasksAndHardships()
    }
    this.taskAccepted = false;
    this.gameService.updateTaskStatus(this.activeTask[0].id, status)
    .then(data => {
      this.refreshPlayers()
    }).catch(err => {
      console.log(err)
    })
  }

  updateProgress(difficulty) {
    let withoutPercent = this.trailProgress.replace('%', '')
    if (difficulty === 1) {
      this.trailProgress = Number(withoutPercent) + 20 + '%';
      return this.trailProgress
    }
    else if(difficulty === 2){
      this.trailProgress = Number(withoutPercent) + 10 + '%';
      return this.trailProgress
    }
    else {
      this.trailProgress = Number(withoutPercent) + 4 + '%';
      return this.trailProgress
    }
  }

  getWagonProgress(progress) {
    let withoutPercent = progress.replace('%', '')
    this.wagonProgress = 108 - withoutPercent + '%'
    return this.wagonProgress
  }

  checkProgress(progress) {
    if (progress === '100%') {
      this.navCtrl.push(WinnerPage, {
        game: this.game,
        players: this.players,
        tasks: this.completedCounter
      });
    }
  }

  delay(ms: number) {
      return new Promise<void>(function(resolve) {
          setTimeout(resolve, 1000);
      });
  }

  async asyncAwait() {
    this.updateProgress(this.game.difficulty)
    this.getWagonProgress(this.trailProgress)
        await this.delay(1000);
    this.checkProgress(this.trailProgress)
  }

  skipTask() {
    this.tasks.pop()
    if (this.tasks.length === 0) {
        this.reseedTasksAndHardships()
    }
    this.taskAccepted = false;
    this.skipCounter++;
    if (this.skipCounter > 1) {
      this.assignPlayerToHardship()
    }
  }

  assignPlayerToHardship(){
      this.isHardship = true;
      this.illPlayer = this.filterOutDead(this.players);
      this.taskSkipped = true;
      this.currentHardship = this.hardships[this.hardships.length - 1]
  }

  continueOn(choice) {
    if (choice === 'Rest Player') {
      this.addRestCount(this.currentHardship.rest_value)
      this.updateHealth()
      this.skipCounter = 0;
      this.taskSkipped = false;
      this.hardships.pop()
      if (this.hardships.length === 0) {
          this.reseedTasksAndHardships()
      }
    }
    else {
      this.decreaseMorale(this.illPlayer)
      this.updateHealth()
      this.skipCounter = 0;
      this.taskSkipped = false;
      this.hardships.pop()
      if (this.hardships.length === 0) {
          this.reseedTasksAndHardships()
      }
    }
  }

  otherOption(choice) {
    if (choice === 'Rest Player') {
      this.addRestCount(this.currentHardship.rest_value)
      this.updateHealth()
      this.skipCounter = 0;
      this.taskSkipped = false;
      this.hardships.pop()
      if (this.hardships.length === 0) {
          this.reseedTasksAndHardships()
      }
    }
    else {
      this.updateHealth()
      this.skipCounter = 0;
      this.taskSkipped = false;
      this.hardships.pop()
      if (this.hardships.length === 0) {
          this.reseedTasksAndHardships()
      }
    }
  }

  decreaseMorale(player) {
    let morale = ['Dead', 'Poor', 'Fair', 'Good', 'Great'];
    let val = this.hardships[this.hardships.length - 1].morale_decrease;
    let newPlayerMoraleIndex;
    let finalNewMorale;
    for (let i = 0; i < morale.length; i++) {
        if (player.morale === morale[i]) {
            var playerMoraleIndex = i;
            newPlayerMoraleIndex = playerMoraleIndex - val;
        }
        if (newPlayerMoraleIndex < 0) {
            finalNewMorale = morale[0]
        }
        else{
          finalNewMorale = morale[newPlayerMoraleIndex]
        }
    }
    this.illPlayer.morale = finalNewMorale
    if (this.illPlayer.morale === 'Dead') {
        this.deathAlert(this.illPlayer)
    }
    if (this.illPlayer.morale === 'Poor') {
        this.poorAlert(this.illPlayer)
    }
    return this.illPlayer.morale
  }

  increaseMorale(player) {
      let morale = ['Dead', 'Poor', 'Fair', 'Good', 'Great'];
      let newPlayerMoraleIndex;
      let finalNewMorale;
      for (let i = 0; i < morale.length; i++) {
          if (player.morale === morale[i]) {
            if (player.morale !== 'Great') {
              var playerMoraleIndex = i;
              newPlayerMoraleIndex = playerMoraleIndex + 1;
              finalNewMorale = morale[newPlayerMoraleIndex]
            }
          }
        }
     this.activePlayer.morale = finalNewMorale;
     this.gameService.updatePlayerHealth(this.activePlayer)
     .then(response => {
       this.refreshPlayers()
     })
     .catch(err => {
       console.log(err)
     })
  }

  addRestCount(count) {
     this.illPlayer.rest_count += count
     return this.illPlayer.rest_count
  }

  decreaseRestCount() {
    this.players.forEach(player => {
      if (player.rest_count > 0) {
        this.gameService.updatePlayerRest(player)
        .then(data => {
          this.refreshPlayers()
          console.log(this.players)
        })
        .catch(error => {
          console.log(error)
        })
      }
    })
  }

  updateHealth() {
    return this.gameService.updatePlayerHealth(this.illPlayer)
    .then(data => {
      this.refreshPlayers()
    }).catch(err => {
      console.log(err)
    })
  }

  getStyle(player){
    if (player.morale === 'Fair') {
      return '#F75733'
    }
    else if(player.morale === 'Great'){
      return '#6AC669'
    }
    else if(player.morale === 'Poor') {
      return 'CE1212'
    }
    else if(player.morale === 'Dead') {
      return 'black'
    }
    else {
      return '#F7B233'
    }
  }

  getBackground(type) {
    if (type === "task") {
      return '10px solid #6AC669'
    }
    else {
      return '10px solid #F7B233'
    }
  }

  refreshPlayers() {
    this.gameService.getPlayers(this.game.id)
    .then(data => {
     this.players = data.sort(this.compare);
     if (this.isEligible(this.players) === false) {
       this.navCtrl.push(LoserPage, {
         game: this.game
       });
     }
    })
    .catch(err => {
      console.log(err)
    })
  }

shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

compare(a,b) {
  if (a.trail_name < b.trail_name)
    return -1;
  if (a.trail_name > b.trail_name)
    return 1;
  return 0;
}

isEligible(arr) {
  let arr2 = []
  arr.forEach(element => {
    if (element.morale !== "Dead" && element.rest_count === 0) {
      arr2.push(element);
    }
  })
  if (arr2.length === 0) {
    return false;
  }
  else {
    return true;
  }
}

filterOutDead(arr) {
  let arr2 = []
  arr.forEach(person => {
    if (person.morale !== 'Dead') {
        arr2.push(person)
    }
  });
  let illPlayer = arr2[Math.floor(Math.random()*arr2.length)]
  return illPlayer;
}

sendHealthyPlayers(arr) {
  let arr2 = []
  arr.forEach(person => {
    if (person.morale !== 'Dead') {
        arr2.push(person)
    }
  });
  return arr2;
}

deathAlert(player) {
   let alert = this.alertCtrl.create({
     title: `${player.trail_name} has Died!`,
     subTitle: 'Mourn the loss for 2 minutes then continue.',
     cssClass: 'alert-death',
     buttons: ['Continue']

   });
   alert.present();
 }

 poorAlert(player) {
    let alert = this.alertCtrl.create({
      title: `${player.trail_name}'s Morale is Poor!`,
      subTitle: `${player.trail_name} should complete a task to increase morale.`,
      cssClass: 'alert-death',
      buttons: ['Continue']

    });
    alert.present();
  }

    reseedTasksAndHardships() {
      this.gameService.getGameDetails(this.gameID)
      .then(game => {
        this.game = game
      }).catch(error => {
        console.log('could not get game details', error)
      }).then(() => {
        this.splitObject()
      }).catch(error => {
        console.log('splitObject', error)
      })
    }

}
