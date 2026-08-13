package com.blockvote.android.di

import com.blockvote.android.data.repository.ElectionRepositoryAdapter
import com.blockvote.android.data.repository.RemoteVotingRepository
import com.blockvote.android.domain.repository.ElectionRepository
import com.blockvote.android.domain.repository.VotingRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindVotingRepository(
        impl: RemoteVotingRepository
    ): VotingRepository

    @Binds
    @Singleton
    abstract fun bindElectionRepository(
        adapter: ElectionRepositoryAdapter
    ): ElectionRepository
}
